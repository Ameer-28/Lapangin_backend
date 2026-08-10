import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  /**
   * Automatically mark 'upcoming' bookings as 'completed'
   * when their scheduled date + startTime + duration has passed.
   */
  private async autoCompleteExpiredBookings() {
    const now = new Date();

    // Find all upcoming bookings
    const upcomingBookings = await this.prisma.booking.findMany({
      where: { status: 'upcoming' },
      select: { id: true, date: true, startTime: true, durationHours: true, userId: true, bookingCode: true },
    });

    const idsToComplete: string[] = [];
    const usersToNotify: { userId: string; bookingCode: string }[] = [];

    for (const b of upcomingBookings) {
      // Parse the booking end time
      const bookingDate = new Date(b.date);
      const startHour = parseInt(b.startTime.split(':')[0], 10);
      const endHour = startHour + (b.durationHours || 1);

      // Build end datetime in UTC (booking dates are stored as UTC midnight)
      // Adjust for WIB (UTC+7): subtract 7 hours so comparison is accurate
      const endDateTime = new Date(bookingDate);
      endDateTime.setUTCHours(endHour - 7, 0, 0, 0);

      if (now >= endDateTime) {
        idsToComplete.push(b.id);
        usersToNotify.push({ userId: b.userId, bookingCode: b.bookingCode });
      }
    }

    if (idsToComplete.length > 0) {
      await this.prisma.booking.updateMany({
        where: { id: { in: idsToComplete } },
        data: { status: 'completed' },
      });

      // Send completion notifications (fire-and-forget)
      for (const { userId, bookingCode } of usersToNotify) {
        this.notificationsService.createNotification(
          userId,
          'Booking Selesai ✅',
          `Booking ${bookingCode} telah selesai. Yuk beri rating pengalaman bermain Anda!`,
          'booking'
        ).catch(() => {});
      }
    }
  }

  async create(userId: string, dto: CreateBookingDto) {
    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || user.role === 'admin') {
      throw new ForbiddenException('Akun Admin tidak diperbolehkan melakukan pemesanan lapangan. Silakan gunakan akun customer.');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      // 1. Find venue
      const venue = await tx.venue.findUnique({
        where: { id: dto.venueId },
      });
      if (!venue || !venue.isActive) {
        throw new NotFoundException('Active venue not found');
      }

      // 2. Check time slots availability
      const startHour = parseInt(dto.startTime.split(':')[0], 10);
      const openHour = parseInt((venue.openTime || '07:00').split(':')[0], 10);
      const closeHour = parseInt((venue.closeTime || '23:00').split(':')[0], 10);

      if (startHour < openHour || (startHour + dto.durationHours) > closeHour) {
        throw new BadRequestException(`Pemesanan melebihi jam operasional venue (${venue.openTime || '07:00'} - ${venue.closeTime || '23:00'}).`);
      }

      const slotsToCheck = [];
      for (let i = 0; i < dto.durationHours; i++) {
        slotsToCheck.push(`${(startHour + i).toString().padStart(2, '0')}:00`);
      }

      const bookingDate = new Date(dto.date + 'T00:00:00.000Z');

      const existingSlots = await tx.timeSlot.findMany({
        where: {
          venueId: dto.venueId,
          date: bookingDate,
          startTime: { in: slotsToCheck },
        },
      });

      const isAnyBooked = existingSlots.some(slot => slot.isBooked);
      if (isAnyBooked) {
        throw new BadRequestException('One or more selected time slots are already booked');
      }

      // 3. Calculate pricing
      const subtotal = venue.pricePerHour * dto.durationHours;
      let discount = 0;
      let usedPromo = null;

      if (dto.promoCode) {
        usedPromo = await tx.promoCode.findFirst({
          where: { code: dto.promoCode },
        });

        if (!usedPromo) throw new BadRequestException('Invalid promo code');
        if (!usedPromo.isActive) throw new BadRequestException('Promo code is not active');
        if (new Date(usedPromo.validUntil) < new Date()) throw new BadRequestException('Promo code expired');
        if (usedPromo.usedCount >= usedPromo.maxUses) throw new BadRequestException('Promo code usage limit exceeded');

        discount = subtotal * (usedPromo.discountPct / 100);
      }

      const serviceFee = 5000;
      const total = subtotal - discount + serviceFee;

      // 4. Generate booking code
      const currentYear = new Date().getFullYear().toString();
      const lastBooking = await tx.booking.findFirst({
        where: {
          bookingCode: {
            startsWith: `BK-${currentYear}-`
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      let nextSequence = 1;
      if (lastBooking) {
        const lastSequence = parseInt(lastBooking.bookingCode.split('-')[2], 10);
        nextSequence = lastSequence + 1;
      }
      const bookingCode = `BK-${currentYear}-${nextSequence.toString().padStart(3, '0')}`;

      // 5. Create booking record
      const booking = await tx.booking.create({
        data: {
          bookingCode,
          userId,
          venueId: dto.venueId,
          date: bookingDate,
          startTime: dto.startTime,
          durationHours: dto.durationHours,
          subtotal,
          discount,
          serviceFee,
          total,
          status: 'upcoming',
          paymentMethod: dto.paymentMethod,
          paymentDetail: dto.paymentDetail,
          promoCode: dto.promoCode,
        },
        include: {
          venue: true,
        }
      });

      // 6. Mark time slots as booked
      for (const time of slotsToCheck) {
        const existingSlot = existingSlots.find(s => s.startTime === time);
        if (existingSlot) {
          await tx.timeSlot.update({
            where: { id: existingSlot.id },
            data: { isBooked: true, bookingId: booking.id },
          });
        } else {
          await tx.timeSlot.create({
            data: {
              venueId: dto.venueId,
              date: bookingDate,
              startTime: time,
              isBooked: true,
              bookingId: booking.id,
            },
          });
        }
      }

      // 7. Increment promo code usage
      if (usedPromo) {
        await tx.promoCode.update({
          where: { id: usedPromo.id },
          data: { usedCount: { increment: 1 } }
        });
      }

      return booking;
    });

    // Send notification
    try {
      await this.notificationsService.createNotification(
        userId,
        'Booking Berhasil! 🎉',
        `Booking ${booking.bookingCode} untuk ${booking.venue?.name || 'venue'} telah berhasil dibuat.`,
        'booking'
      );
    } catch (e) {
      // Don't fail the booking if notification fails
    }
    return booking;
  }

  async findAllByUser(userId: string, query: QueryBookingsDto) {
    await this.autoCompleteExpiredBookings();

    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          venue: {
            select: { name: true, imageUrl: true }
          }
        }
      }),
      this.prisma.booking.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        venue: true,
        user: {
          select: { id: true, email: true, fullName: true, phone: true }
        }
      }
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async cancel(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new BadRequestException('Cannot cancel this booking');
    }

    if (booking.status !== 'upcoming') {
      throw new BadRequestException(`Cannot cancel booking with status: ${booking.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled' }
      });

      await tx.timeSlot.updateMany({
        where: { bookingId: id },
        data: { isBooked: false, bookingId: null }
      });

      return cancelledBooking;
    });

    try {
      await this.notificationsService.createNotification(
        userId,
        'Booking Dibatalkan',
        `Booking Anda telah berhasil dibatalkan.`,
        'booking'
      );
    } catch (e) {}

    return result;
  }

  async rebook(id: string, userId: string) {
    const oldBooking = await this.prisma.booking.findUnique({
      where: { id, userId }
    });

    if (!oldBooking) {
      throw new NotFoundException('Booking not found');
    }

    return {
      venueId: oldBooking.venueId,
      durationHours: oldBooking.durationHours,
    };
  }

  // Admin methods
  async adminFindAll(query: QueryBookingsDto) {
    await this.autoCompleteExpiredBookings();

    const { status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          venue: {
            select: { name: true }
          },
          user: {
            select: { fullName: true, email: true }
          }
        }
      }),
      this.prisma.booking.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminCancel(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'upcoming') {
      throw new BadRequestException(`Cannot cancel booking with status: ${booking.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: { status: 'cancelled' }
      });

      await tx.timeSlot.updateMany({
        where: { bookingId: id },
        data: { isBooked: false, bookingId: null }
      });

      return cancelledBooking;
    });

    try {
      await this.notificationsService.createNotification(
        booking.userId,
        'Booking Dibatalkan oleh Admin',
        `Booking ${booking.bookingCode} telah dibatalkan oleh admin.`,
        'booking'
      );
    } catch (e) {}

    return result;
  }

  async getStats() {
    await this.autoCompleteExpiredBookings();

    const [total, upcoming, completed, cancelled] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'upcoming' } }),
      this.prisma.booking.count({ where: { status: 'completed' } }),
      this.prisma.booking.count({ where: { status: 'cancelled' } }),
    ]);

    return {
      total,
      upcoming,
      completed,
      cancelled
    };
  }
}
