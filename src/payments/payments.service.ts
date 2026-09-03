import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSnapTokenDto } from './dto/create-snap-token.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const midtransClient = require('midtrans-client');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private snap: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
    const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

    this.snap = new midtransClient.Snap({
      isProduction,
      serverKey,
      clientKey,
    });
  }

  /**
   * Create a Midtrans Snap token for a booking
   */
  async createSnapToken(userId: string, dto: CreateSnapTokenDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        venue: true,
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${dto.bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You are not allowed to pay for this booking');
    }

    if (booking.paymentStatus === 'paid') {
      throw new BadRequestException('Booking is already paid');
    }

    // If snap token already exists and payment is still pending, return existing token
    if (booking.snapToken && booking.paymentStatus === 'pending') {
      return {
        snapToken: booking.snapToken,
        orderId: booking.midtransOrderId,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
      };
    }

    // Generate unique order ID
    const orderId = `LAPANGIN-${booking.bookingCode}-${Date.now()}`;

    // Build item details matching gross_amount exactly
    const itemDetails: any[] = [];
    const breakdown = Array.isArray(booking.priceBreakdown) ? (booking.priceBreakdown as any[]) : null;

    if (breakdown && breakdown.length > 0) {
      for (const slot of breakdown) {
        itemDetails.push({
          id: `${booking.venueId}-${slot.time}`.slice(0, 50),
          price: slot.price,
          quantity: 1,
          name: `${booking.venue.name} (${slot.time}${slot.ruleName ? ' - ' + slot.ruleName : ''})`.slice(0, 50),
        });
      }
    } else {
      itemDetails.push({
        id: booking.venueId.slice(0, 50),
        price: booking.subtotal,
        quantity: 1,
        name: `Sewa ${booking.venue.name} (${booking.durationHours} jam)`.slice(0, 50),
      });
    }

    if (booking.serviceFee > 0) {
      itemDetails.push({
        id: 'SERVICE_FEE',
        price: booking.serviceFee,
        quantity: 1,
        name: 'Service Fee',
      });
    }

    if (booking.discount > 0) {
      itemDetails.push({
        id: 'DISCOUNT',
        price: -Math.round(booking.discount),
        quantity: 1,
        name: `Promo (${booking.promoCode || 'Diskon'})`.slice(0, 50),
      });
    }

    const transactionParams = {
      transaction_details: {
        order_id: orderId,
        gross_amount: booking.total,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: booking.user.fullName,
        email: booking.user.email,
        phone: booking.user.phone || '',
      },
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/bookings/status?bookingId=${booking.id}`,
      },
    };

    try {
      const transaction = await this.snap.createTransaction(transactionParams);

      // Save snap token and order ID to booking
      await this.prisma.booking.update({
        where: { id: dto.bookingId },
        data: {
          midtransOrderId: orderId,
          snapToken: transaction.token,
          paymentStatus: 'pending',
        },
      });

      this.logger.log(`Snap token created for booking ${dto.bookingId}, orderId: ${orderId}`);

      const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

      return {
        snapToken: transaction.token,
        redirectUrl: transaction.redirect_url,
        orderId,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
        isProduction,
      };
    } catch (error) {
      this.logger.error(`Failed to create Midtrans transaction: ${error.message}`);
      throw new BadRequestException(`Payment gateway error: ${error.message}`);
    }
  }

  /**
   * Handle webhook notification from Midtrans
   */
  async handleNotification(notificationBody: any) {
    try {
      const statusResponse = await this.snap.transaction.notification(notificationBody);

      const orderId = statusResponse.order_id;
      const statusCode = statusResponse.status_code;
      const grossAmount = statusResponse.gross_amount;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;
      const paymentType = statusResponse.payment_type;

      this.logger.log(
        `Midtrans notification received - OrderID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`,
      );

      // Verify SHA-512 signature key for security
      const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
      if (serverKey && statusResponse.signature_key) {
        const crypto = await import('crypto');
        const expectedSignature = crypto
          .createHash('sha512')
          .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
          .digest('hex');

        if (expectedSignature !== statusResponse.signature_key) {
          this.logger.error(`Invalid Midtrans signature for order ${orderId}`);
          throw new ForbiddenException('Invalid Midtrans signature key');
        }
      }

      const booking = await this.prisma.booking.findUnique({
        where: { midtransOrderId: orderId },
      });

      if (!booking) {
        this.logger.warn(`Booking not found for Midtrans order: ${orderId}`);
        return { status: 'booking_not_found' };
      }

      // Idempotency: skip if already processed in this state
      if (booking.status === 'upcoming' && booking.paymentStatus === 'paid') {
        if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
          this.logger.log(`Midtrans notification for order ${orderId} already processed (status: upcoming).`);
          return { status: 'already_processed' };
        }
      }
      if ((booking.status === 'cancelled' || booking.status === 'expired') &&
          (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire')) {
        this.logger.log(`Midtrans notification for order ${orderId} already processed as cancelled/expired.`);
        return { status: 'already_processed' };
      }

      let paymentStatus = booking.paymentStatus;
      let paidAt = booking.paidAt;

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          paymentStatus = 'paid';
          paidAt = new Date();
        } else if (fraudStatus === 'challenge') {
          paymentStatus = 'pending';
        }
      } else if (transactionStatus === 'settlement') {
        paymentStatus = 'paid';
        paidAt = new Date();
      } else if (
        transactionStatus === 'cancel' ||
        transactionStatus === 'deny'
      ) {
        paymentStatus = 'failed';
      } else if (transactionStatus === 'expire') {
        paymentStatus = 'expired';
      } else if (transactionStatus === 'pending') {
        paymentStatus = 'pending';
      }

      // If payment successful, transition from pending_payment to upcoming
      if (paymentStatus === 'paid') {
        await this.prisma.$transaction([
          this.prisma.timeSlot.updateMany({
            where: { bookingId: booking.id },
            data: { isBooked: true },
          }),
          this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'upcoming',
              paymentStatus: 'paid',
              paymentMethod: paymentType,
              paymentDetail: `${paymentType} - ${transactionStatus}`,
              paidAt: paidAt || new Date(),
            },
          }),
        ]);

        // Send booking confirmation notification
        try {
          await this.notificationsService.createNotification(
            booking.userId,
            'Pembayaran Berhasil! 🎉',
            `Pembayaran booking ${booking.bookingCode} telah dikonfirmasi oleh Midtrans. Selamat bermain!`,
            'booking',
          );
        } catch (_) {}
      } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
        await this.prisma.$transaction([
          this.prisma.timeSlot.updateMany({
            where: { bookingId: booking.id },
            data: { isBooked: false, bookingId: null },
          }),
          this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: paymentStatus === 'expired' ? 'expired' : 'cancelled',
              paymentStatus,
              paymentMethod: paymentType,
              paymentDetail: `${paymentType} - ${transactionStatus}`,
            },
          }),
        ]);

        try {
          await this.notificationsService.createNotification(
            booking.userId,
            paymentStatus === 'expired' ? 'Batas Pembayaran Habis' : 'Pembayaran Gagal / Dibatalkan',
            `Transaksi booking ${booking.bookingCode} ${paymentStatus === 'expired' ? 'telah kedaluwarsa' : 'dibatalkan atau gagal'}. Slot waktu telah dilepaskan kembali.`,
            'booking',
          );
        } catch (_) {}
      } else {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: 'pending',
            paymentMethod: paymentType,
            paymentDetail: `${paymentType} - ${transactionStatus}`,
          },
        });
      }

      this.logger.log(
        `Booking ${booking.id} status updated to ${paymentStatus === 'paid' ? 'upcoming' : paymentStatus}`,
      );

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Error handling Midtrans notification: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to process payment notification');
    }
  }

  /**
   * Get payment status for a booking
   */
  async getPaymentStatus(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingCode: true,
        paidAt: true,
        paymentMethod: true,
        paymentDetail: true,
        paymentStatus: true,
        midtransOrderId: true,
        total: true,
        snapToken: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return booking;
  }
}
