import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSnapTokenDto } from './dto/create-snap-token.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const midtransClient = require('midtrans-client');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private snap: any;

  constructor(private readonly prisma: PrismaService) {
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

    const transactionParams = {
      transaction_details: {
        order_id: orderId,
        gross_amount: booking.total,
      },
      item_details: [
        {
          id: booking.venueId,
          price: booking.venue.pricePerHour,
          quantity: booking.durationHours,
          name: `${booking.venue.name} - ${booking.startTime}`,
        },
        {
          id: 'SERVICE_FEE',
          price: booking.serviceFee,
          quantity: 1,
          name: 'Service Fee',
        },
      ],
      customer_details: {
        first_name: booking.user.fullName,
        email: booking.user.email,
        phone: booking.user.phone || '',
      },
      callbacks: {
        finish: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/bookings/status?bookingId=${booking.id}`,
      },
    };

    // Handle discount as a negative item
    if (booking.discount > 0) {
      const discountAmount = Math.round(booking.subtotal * booking.discount);
      transactionParams.item_details.push({
        id: 'DISCOUNT',
        price: -discountAmount,
        quantity: 1,
        name: `Promo Discount (${booking.promoCode || 'Promo'})`,
      });
    }

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

      // If payment failed, cancelled, or expired, automatically release the booked time slots
      if (paymentStatus === 'failed' || paymentStatus === 'expired') {
        await this.prisma.$transaction([
          this.prisma.timeSlot.updateMany({
            where: { bookingId: booking.id },
            data: { isBooked: false, bookingId: null },
          }),
          this.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'cancelled',
              paymentStatus,
              paymentMethod: paymentType,
              paymentDetail: `${paymentType} - ${transactionStatus}`,
            },
          }),
        ]);
      } else {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus,
            paymentMethod: paymentType,
            paymentDetail: `${paymentType} - ${transactionStatus}`,
            paidAt,
          },
        });
      }

      this.logger.log(
        `Booking ${booking.id} payment status updated to: ${paymentStatus}`,
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
