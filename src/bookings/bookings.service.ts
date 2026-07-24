import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookingDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Find venue
      const venue = await tx.venue.findUnique({
        where: { id: dto.venueId },
      });
      if (!venue || !venue.isActive) {
        throw new NotFoundException('Active venue not found');
      }

      // 2. Check time slots availability
      const startHour = parseInt(dto.startTime.split(':')[0], 10);
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
  }

  async findAllByUser(userId: string, query: QueryBookingsDto) {
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

    return await this.prisma.$transaction(async (tx) => {
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

    return await this.prisma.$transaction(async (tx) => {
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
  }

  async getStats() {
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
