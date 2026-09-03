import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CreateAdminBookingDto } from './dto/create-admin-booking.dto';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private isCancellingUnpaid = false;

  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCronAutoCancelUnpaid() {
    if (this.isCancellingUnpaid) return;
    this.isCancellingUnpaid = true;
    try {
      await this.autoCancelUnpaidBookings();
    } catch (err) {
      this.logger.error('Error during auto-canceling unpaid bookings:', err);
    } finally {
      this.isCancellingUnpaid = false;
    }
  }

  /**
   * Automatically cancel unpaid customer bookings that exceed 15 minutes hold timeout,
   * releasing the time slots so others can book.
   */
  async autoCancelUnpaidBookings() {
    const now = new Date();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Find unpaid/pending customer bookings whose payment deadline has passed
    const expiredUnpaid = await this.prisma.booking.findMany({
      where: {
        OR: [
          { status: 'pending_payment', paymentExpiresAt: { lt: now } },
          { status: 'pending_payment', createdAt: { lt: fifteenMinutesAgo } },
          { status: 'upcoming', paymentStatus: { in: ['unpaid', 'pending'] }, createdAt: { lt: fifteenMinutesAgo } }
        ],
        NOT: {
          bookingCode: { startsWith: 'BK-OFFLINE' },
        },
      },
      select: { id: true, bookingCode: true, userId: true },
    });

    if (expiredUnpaid.length === 0) return;

    const expiredIds = expiredUnpaid.map(b => b.id);

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Release slots
        await tx.timeSlot.updateMany({
          where: { bookingId: { in: expiredIds } },
          data: { isBooked: false, bookingId: null },
        });

        // 2. Mark bookings as expired
        await tx.booking.updateMany({
          where: { id: { in: expiredIds } },
          data: { status: 'expired', paymentStatus: 'expired' },
        });
      });

      // Send notifications (fire-and-forget)
      for (const b of expiredUnpaid) {
        this.notificationsService.createNotification(
          b.userId,
          'Batas Waktu Pembayaran Habis',
          `Booking ${b.bookingCode} telah dibatalkan otomatis karena batas waktu pembayaran 15 menit telah habis.`,
          'booking'
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Error auto-cancelling unpaid bookings:', e);
    }
  }

  /**
   * Automatically mark 'upcoming' bookings as 'completed'
   * when their scheduled date + startTime + duration has passed.
   */
  private async autoCompleteExpiredBookings() {
    await this.autoCancelUnpaidBookings();
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
      let vOpen = isNaN(openHour) ? 7 : openHour;
      let vClose = isNaN(closeHour) ? 23 : closeHour;
      if (vClose <= vOpen || (venue.openTime === '00:00' && (venue.closeTime === '24:00' || venue.closeTime === '00:00'))) {
        vOpen = 0;
        vClose = 24;
      }

      if (startHour < vOpen || (startHour + dto.durationHours) > vClose) {
        throw new BadRequestException(`Pemesanan melebihi jam operasional venue (${venue.openTime || '07:00'} - ${venue.closeTime || '23:00'}).`);
      }

      const slotsToCheck = [];
      for (let i = 0; i < dto.durationHours; i++) {
        slotsToCheck.push(`${(startHour + i).toString().padStart(2, '0')}:00`);
      }

      const bookingDate = new Date(dto.date + 'T00:00:00.000Z');

      // 2a. Determine target Court
      let targetCourt: any;
      if (dto.courtId) {
        targetCourt = await tx.court.findUnique({
          where: { id: dto.courtId },
        });
        if (!targetCourt || targetCourt.venueId !== dto.venueId) {
          throw new BadRequestException('Lapangan yang dipilih tidak valid untuk venue ini');
        }
        if (!targetCourt.isActive) {
          throw new BadRequestException('Lapangan ini sedang tidak aktif / tidak dapat dibooking');
        }
      } else {
        targetCourt = await tx.court.findFirst({
          where: { venueId: dto.venueId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!targetCourt) {
          targetCourt = await tx.court.create({
            data: {
              venueId: dto.venueId,
              name: 'Lapangan 1 (Utama)',
              courtType: venue.type === 'Outdoor' ? 'Rumput Sintetis' : 'Vinyl',
              pricePerHour: venue.pricePerHour,
            },
          });
        }
      }
      const targetCourtId = targetCourt.id;

      // Check operational closures
      const closures = await tx.venueClosure.findMany({
        where: { venueId: dto.venueId, date: bookingDate },
      });
      for (const closure of closures) {
        if (!closure.startTime && !closure.endTime) {
          throw new BadRequestException(`Venue sedang tutup pada tanggal ${dto.date} (${closure.reason})`);
        }
        const closeStart = parseInt(closure.startTime!.split(':')[0], 10);
        const closeEnd = parseInt(closure.endTime!.split(':')[0], 10);
        if (Math.max(startHour, closeStart) < Math.min(startHour + dto.durationHours, closeEnd)) {
          throw new BadRequestException(
            `Slot waktu berada dalam periode penutupan venue (${closure.startTime} - ${closure.endTime}: ${closure.reason})`
          );
        }
      }

      // Check existing slots for THIS COURT
      const existingSlots = await tx.timeSlot.findMany({
        where: {
          courtId: targetCourtId,
          date: bookingDate,
          startTime: { in: slotsToCheck },
        },
      });

      const isAnyBooked = existingSlots.some(slot => slot.isBooked);
      if (isAnyBooked) {
        throw new BadRequestException(`Salah satu atau lebih slot waktu yang dipilih di ${targetCourt.name} sudah terisi`);
      }

      // 3. Calculate pricing using court rate if specified, else venue rate
      const hourlyPrice = targetCourt.pricePerHour ?? venue.pricePerHour;
      const subtotal = hourlyPrice * dto.durationHours;
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
          courtId: targetCourtId,
          date: bookingDate,
          startTime: dto.startTime,
          durationHours: dto.durationHours,
          subtotal,
          discount,
          serviceFee,
          total,
          status: 'pending_payment',
          paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          paymentStatus: 'pending',
          paymentMethod: dto.paymentMethod,
          paymentDetail: dto.paymentDetail || 'Menunggu Pembayaran',
          promoCode: dto.promoCode,
        },
        include: {
          venue: true,
          court: true,
        }
      });

      // 6. Mark time slots as booked for this court
      for (const time of slotsToCheck) {
        const existingSlot = existingSlots.find(s => s.startTime === time);
        if (existingSlot) {
          await tx.timeSlot.update({
            where: { id: existingSlot.id },
            data: { isBooked: true, bookingId: booking.id, venueId: dto.venueId },
          });
        } else {
          await tx.timeSlot.create({
            data: {
              venueId: dto.venueId,
              courtId: targetCourtId,
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
          },
          court: {
            select: { id: true, name: true, courtType: true }
          },
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
        court: true,
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
        { customerName: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { venue: { name: { contains: search, mode: 'insensitive' } } },
        { court: { name: { contains: search, mode: 'insensitive' } } },
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
            select: { name: true, city: true, pricePerHour: true }
          },
          court: {
            select: { id: true, name: true, courtType: true, pricePerHour: true }
          },
          user: {
            select: { fullName: true, email: true, phone: true }
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

    if (booking.status !== 'upcoming' && booking.status !== 'pending_payment') {
      throw new BadRequestException(`Cannot cancel booking with status: ${booking.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const cancelledBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          paymentStatus: booking.paymentStatus === 'paid' ? 'refunded' : 'failed',
        }
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

  /**
   * Admin-only offline walk-in booking and manual slot blocking
   */
  async adminCreateOfflineBooking(adminId: string, dto: CreateAdminBookingDto) {
    // 1. Run maintenance/expiration cleanup first
    await this.autoCancelUnpaidBookings();

    return await this.prisma.$transaction(async (tx) => {
      // Find venue
      const venue = await tx.venue.findUnique({
        where: { id: dto.venueId },
      });
      if (!venue || !venue.isActive) {
        throw new NotFoundException('Venue tidak ditemukan atau sedang tidak aktif');
      }

      // Check operational hours
      const openHour = parseInt((venue.openTime || '07:00').split(':')[0], 10);
      const closeHour = parseInt((venue.closeTime || '23:00').split(':')[0], 10);
      const startHour = parseInt(dto.startTime.split(':')[0], 10);
      const endHour = startHour + dto.durationHours;

      if (startHour < openHour || endHour > closeHour) {
        throw new BadRequestException(
          `Waktu booking (${dto.startTime} - ${endHour.toString().padStart(2, '0')}:00) berada di luar jam operasional venue (${venue.openTime} - ${venue.closeTime}).`
        );
      }

      // Build array of hourly slots to reserve
      const slotsToCheck: string[] = [];
      for (let i = 0; i < dto.durationHours; i++) {
        slotsToCheck.push(`${(startHour + i).toString().padStart(2, '0')}:00`);
      }

      const bookingDate = new Date(dto.date + 'T00:00:00.000Z');

      // Determine target court
      let targetCourt: any;
      if (dto.courtId) {
        targetCourt = await tx.court.findUnique({
          where: { id: dto.courtId },
        });
        if (!targetCourt || targetCourt.venueId !== dto.venueId) {
          throw new NotFoundException('Lapangan tidak ditemukan di venue ini');
        }
      } else {
        targetCourt = await tx.court.findFirst({
          where: { venueId: dto.venueId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!targetCourt) {
          targetCourt = await tx.court.create({
            data: {
              venueId: dto.venueId,
              name: 'Lapangan 1 (Utama)',
              courtType: venue.type === 'Outdoor' ? 'Rumput Sintetis' : 'Vinyl',
              pricePerHour: venue.pricePerHour,
            },
          });
        }
      }
      const targetCourtId = targetCourt.id;

      // 1. Conflict Check: Overlapping Bookings on the same court & date
      const activeBookings = await tx.booking.findMany({
        where: {
          venueId: dto.venueId,
          courtId: targetCourtId,
          date: bookingDate,
          status: { in: ['upcoming', 'pending_payment'] },
        },
        include: {
          user: { select: { fullName: true } },
        },
      });

      const now = new Date();
      for (const ob of activeBookings) {
        // Skip expired pending holds
        if (ob.status === 'pending_payment' && ob.paymentExpiresAt && ob.paymentExpiresAt < now) {
          continue;
        }

        const obStart = parseInt(ob.startTime.split(':')[0], 10);
        const obEnd = obStart + ob.durationHours;

        // Interval overlap formula: max(start1, start2) < min(end1, end2)
        if (Math.max(startHour, obStart) < Math.min(endHour, obEnd)) {
          const overlapStart = Math.max(startHour, obStart).toString().padStart(2, '0') + ':00';
          const overlapEnd = Math.min(endHour, obEnd).toString().padStart(2, '0') + ':00';
          const conflictType = ob.bookingSource && ob.bookingSource !== 'online'
            ? `Offline Booking / Blokir Slot (${ob.bookingSource})`
            : ob.status === 'pending_payment'
              ? 'Hold Pembayaran Online Pelanggan'
              : 'Booking Terkonfirmasi';
          const bookedByName = ob.customerName || ob.user?.fullName || 'Customer';

          throw new ConflictException(
            `Jadwal bentrok pada pukul ${overlapStart} - ${overlapEnd} di ${targetCourt.name}! Slot sudah dipesan/diblokir oleh ${conflictType} atas nama "${bookedByName}". Silakan pilih jam atau lapangan lain.`
          );
        }
      }

      // 2. Conflict Check: Physical TimeSlots table for this court
      const existingSlots = await tx.timeSlot.findMany({
        where: {
          courtId: targetCourtId,
          date: bookingDate,
          startTime: { in: slotsToCheck },
        },
        include: {
          booking: { select: { status: true, customerName: true } },
        },
      });

      for (const slot of existingSlots) {
        if (slot.isBooked && slot.booking?.status !== 'expired' && slot.booking?.status !== 'cancelled') {
          throw new ConflictException(
            `Slot jam ${slot.startTime} di ${targetCourt.name} pada tanggal ${dto.date} sudah terisi atau diblokir. Silakan pilih jam lain.`
          );
        }
      }

      // Calculate pricing
      const hourlyPrice = targetCourt.pricePerHour ?? venue.pricePerHour;
      const subtotal = dto.price !== undefined ? dto.price : (hourlyPrice * dto.durationHours);
      const total = subtotal;

      // Generate unique offline booking code
      const currentYear = new Date().getFullYear().toString();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const bookingCode = `BK-OFFLINE-${currentYear}-${Date.now().toString().slice(-4)}${randomSuffix}`;

      // Determine booking source (default: walk_in)
      const bookingSource = dto.bookingSource || 'walk_in';

      // Create booking record with audit trail
      const booking = await tx.booking.create({
        data: {
          bookingCode,
          userId: adminId,
          venueId: dto.venueId,
          courtId: targetCourtId,
          date: bookingDate,
          startTime: dto.startTime,
          durationHours: dto.durationHours,
          subtotal,
          discount: 0,
          serviceFee: 0,
          total,
          status: 'upcoming',
          bookingSource,
          adminNotes: dto.notes,
          createdBy: adminId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          paymentMethod: dto.paymentMethod || 'cash',
          paymentDetail: `${dto.customerName}${dto.customerPhone ? ' (' + dto.customerPhone + ')' : ''} [${bookingSource}]`,
          paymentStatus: dto.paymentStatus || 'paid',
          paidAt: dto.paymentStatus === 'unpaid' ? null : new Date(),
        },
        include: {
          venue: true,
          court: true,
        },
      });

      // Mark time slots as booked for this court
      for (const time of slotsToCheck) {
        const existingSlot = existingSlots.find(s => s.startTime === time);
        if (existingSlot) {
          await tx.timeSlot.update({
            where: { id: existingSlot.id },
            data: { isBooked: true, bookingId: booking.id, venueId: dto.venueId },
          });
        } else {
          await tx.timeSlot.create({
            data: {
              venueId: dto.venueId,
              courtId: targetCourtId,
              date: bookingDate,
              startTime: time,
              isBooked: true,
              bookingId: booking.id,
            },
          });
        }
      }

      return booking;
    });
  }

  /**
   * Admin reschedule booking to a new date and time atomically.
   */
  async adminReschedule(adminId: string, bookingId: string, dto: RescheduleBookingDto) {
    // 1. Fetch existing booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        venue: true,
        user: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    if (booking.status !== 'upcoming' && booking.status !== 'pending_payment') {
      throw new BadRequestException(`Tidak dapat menjadwalkan ulang booking dengan status: ${booking.status}`);
    }

    // 2. Clean up expired holds
    await this.autoCancelUnpaidBookings();

    const openHour = parseInt((booking.venue.openTime || '07:00').split(':')[0], 10);
    const closeHour = parseInt((booking.venue.closeTime || '23:00').split(':')[0], 10);
    const newStartHour = parseInt(dto.newStartTime.split(':')[0], 10);
    const newEndHour = newStartHour + booking.durationHours;

    if (newStartHour < openHour || newEndHour > closeHour) {
      throw new BadRequestException(
        `Jadwal baru (${dto.newStartTime} - ${newEndHour.toString().padStart(2, '0')}:00) berada di luar jam operasional venue (${booking.venue.openTime} - ${booking.venue.closeTime}).`
      );
    }

    const newBookingDate = new Date(dto.newDate + 'T00:00:00.000Z');
    const newSlotsToCheck: string[] = [];
    for (let i = 0; i < booking.durationHours; i++) {
      newSlotsToCheck.push(`${(newStartHour + i).toString().padStart(2, '0')}:00`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Determine target court for reschedule
      let targetCourtId: string | null = dto.newCourtId || booking.courtId || null;
      if (!targetCourtId) {
        const defaultCourt = await tx.court.findFirst({
          where: { venueId: booking.venueId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        targetCourtId = defaultCourt ? defaultCourt.id : null;
      }

      // 3. Check venue closures
      const closures = await tx.venueClosure.findMany({
        where: { venueId: booking.venueId, date: newBookingDate },
      });

      for (const closure of closures) {
        if (!closure.startTime && !closure.endTime) {
          throw new ConflictException(`Venue tutup pada tanggal ${dto.newDate} karena: ${closure.reason}`);
        }
        const closeStart = parseInt(closure.startTime!.split(':')[0], 10);
        const closeEnd = parseInt(closure.endTime!.split(':')[0], 10);
        if (Math.max(newStartHour, closeStart) < Math.min(newEndHour, closeEnd)) {
          throw new ConflictException(
            `Jadwal baru bertabrakan dengan penutupan operasional venue (${closure.startTime} - ${closure.endTime}: ${closure.reason})`
          );
        }
      }

      // 4. Check overlapping bookings on the target court (excluding the current booking itself)
      const activeBookings = await tx.booking.findMany({
        where: {
          venueId: booking.venueId,
          courtId: targetCourtId,
          date: newBookingDate,
          id: { not: bookingId },
          status: { in: ['upcoming', 'pending_payment'] },
        },
        include: {
          user: { select: { fullName: true } },
        },
      });

      const now = new Date();
      for (const ob of activeBookings) {
        if (ob.status === 'pending_payment' && ob.paymentExpiresAt && ob.paymentExpiresAt < now) {
          continue;
        }
        const obStart = parseInt(ob.startTime.split(':')[0], 10);
        const obEnd = obStart + ob.durationHours;

        if (Math.max(newStartHour, obStart) < Math.min(newEndHour, obEnd)) {
          const conflictType = ob.bookingSource && ob.bookingSource !== 'online'
            ? `Booking Offline (${ob.bookingSource})`
            : ob.status === 'pending_payment'
              ? 'Hold Online'
              : 'Booking Terkonfirmasi';
          const bookedByName = ob.customerName || ob.user?.fullName || 'Customer';
          throw new ConflictException(
            `Jadwal baru bentrok dengan ${conflictType} atas nama "${bookedByName}" pada jam ${ob.startTime}. Silakan pilih waktu atau lapangan lain.`
          );
        }
      }

      // 5. Check physical time slots on target court
      const existingSlots = await tx.timeSlot.findMany({
        where: {
          courtId: targetCourtId,
          date: newBookingDate,
          startTime: { in: newSlotsToCheck },
        },
        include: {
          booking: { select: { status: true, customerName: true } },
        },
      });

      for (const slot of existingSlots) {
        if (slot.isBooked && slot.bookingId !== bookingId && slot.booking?.status !== 'expired' && slot.booking?.status !== 'cancelled') {
          throw new ConflictException(`Slot jam ${slot.startTime} pada tanggal ${dto.newDate} sudah terisi.`);
        }
      }

      // 6. Release old slots
      await tx.timeSlot.updateMany({
        where: { bookingId },
        data: { isBooked: false, bookingId: null },
      });

      // 7. Reserve new slots on target court
      for (const time of newSlotsToCheck) {
        const existingSlot = existingSlots.find(s => s.startTime === time);
        if (existingSlot) {
          await tx.timeSlot.update({
            where: { id: existingSlot.id },
            data: { isBooked: true, bookingId },
          });
        } else {
          await tx.timeSlot.create({
            data: {
              venueId: booking.venueId,
              courtId: targetCourtId,
              date: newBookingDate,
              startTime: time,
              isBooked: true,
              bookingId,
            },
          });
        }
      }

      // 8. Update booking record
      const oldDateStr = booking.date ? new Date(booking.date).toISOString().split('T')[0] : '';
      const rescheduleLog = `[Rescheduled by Admin on ${new Date().toISOString()}: ${oldDateStr} ${booking.startTime} -> ${dto.newDate} ${dto.newStartTime}. Reason: ${dto.reason || '-'}]`;
      const updatedAdminNotes = booking.adminNotes ? `${booking.adminNotes}\n${rescheduleLog}` : rescheduleLog;

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          courtId: targetCourtId,
          date: newBookingDate,
          startTime: dto.newStartTime,
          adminNotes: updatedAdminNotes,
        },
        include: {
          venue: true,
          court: true,
          user: true,
        },
      });

      // 9. Notify customer
      try {
        await this.notificationsService.createNotification(
          booking.userId,
          'Jadwal Booking Diubah 📅',
          `Booking ${booking.bookingCode} telah di-reschedule oleh admin ke tanggal ${dto.newDate} pukul ${dto.newStartTime}.${dto.reason ? ' Alasan: ' + dto.reason : ''}`,
          'booking'
        );
      } catch (_) {}

      return updatedBooking;
    });
  }
}
