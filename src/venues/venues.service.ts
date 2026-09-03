import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateVenueClosureDto } from './dto/create-venue-closure.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryVenuesDto) {
    const { search, type, minRating, minPrice, maxPrice, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) where.type = type;
    if (minRating !== undefined) where.rating = { gte: minRating };
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.pricePerHour = {};
      if (minPrice !== undefined) where.pricePerHour.gte = minPrice;
      if (maxPrice !== undefined) where.pricePerHour.lte = maxPrice;
    }

    const [total, data] = await Promise.all([
      this.prisma.venue.count({ where }),
      this.prisma.venue.findMany({
        where,
        skip,
        take: limit,
      }),
    ]);

    return { data, total, page, limit };
  }

  async findFeatured() {
    return this.prisma.venue.findMany({
      where: { isActive: true },
      orderBy: { rating: 'desc' },
      take: 3,
    });
  }

  async findOne(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: {
        _count: { select: { reviews: true } },
        courts: {
          orderBy: { createdAt: 'asc' },
        },
      }
    });

    if (!venue) {
      throw new NotFoundException(`Venue with ID ${id} not found`);
    }
    
    return venue;
  }

  async getTimeSlots(venueId: string, dateStr: string, courtId?: string) {
    const venue = await this.prisma.venue.findUnique({ 
      where: { id: venueId },
      include: {
        courts: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!venue) throw new NotFoundException(`Venue with ID ${venueId} not found`);

    let targetCourt: any = courtId 
      ? venue.courts.find(c => c.id === courtId)
      : venue.courts.find(c => c.isActive) || venue.courts[0];

    if (!targetCourt && courtId) {
      targetCourt = (await this.prisma.court.findUnique({ where: { id: courtId } })) as any;
    }

    if (!targetCourt) {
      targetCourt = (await this.prisma.court.create({
        data: {
          venueId,
          name: 'Lapangan 1 (Utama)',
          courtType: venue.type === 'Outdoor' ? 'Rumput Sintetis' : 'Vinyl',
          pricePerHour: venue.pricePerHour,
        },
      })) as any;
    }

    const targetCourtId = targetCourt.id;
    const courtPrice = targetCourt.pricePerHour ?? venue.pricePerHour;
    const dateObj = new Date(dateStr + 'T00:00:00.000Z');

    // Auto-release any unpaid customer booking slots that exceeded 15 min hold timeout
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const expiredUnpaid = await this.prisma.booking.findMany({
        where: {
          venueId,
          courtId: targetCourtId,
          date: dateObj,
          status: 'upcoming',
          paymentStatus: { in: ['unpaid', 'pending'] },
          createdAt: { lt: fifteenMinutesAgo },
          NOT: { bookingCode: { startsWith: 'BK-OFFLINE' } },
        },
        select: { id: true },
      });
      if (expiredUnpaid.length > 0) {
        const expiredIds = expiredUnpaid.map(b => b.id);
        await this.prisma.$transaction([
          this.prisma.timeSlot.updateMany({
            where: { bookingId: { in: expiredIds } },
            data: { isBooked: false, bookingId: null },
          }),
          this.prisma.booking.updateMany({
            where: { id: { in: expiredIds } },
            data: { status: 'cancelled', paymentStatus: 'expired' },
          }),
        ]);
      }
    } catch (_) {}

    const openHour = parseInt((venue.openTime || '07:00').split(':')[0], 10);
    const closeHour = parseInt((venue.closeTime || '23:00').split(':')[0], 10);
    let startHour = isNaN(openHour) ? 7 : openHour;
    let endHour = isNaN(closeHour) ? 23 : closeHour;
    if (endHour <= startHour || (venue.openTime === '00:00' && (venue.closeTime === '24:00' || venue.closeTime === '00:00'))) {
      startHour = 0;
      endHour = 24;
    }

    let slots = await this.prisma.timeSlot.findMany({
      where: { courtId: targetCourtId, date: dateObj },
      orderBy: { startTime: 'asc' },
    });

    // Filter out any existing database slots outside the venue's operating hours
    slots = slots.filter(slot => {
      const h = parseInt(slot.startTime.split(':')[0], 10);
      return !isNaN(h) && h >= startHour && h < endHour;
    });

    // Auto-generate time slots for the court on this day if none exist
    if (slots.length === 0) {
      const newSlots = [];
      for (let i = startHour; i < endHour; i++) {
        const startTime = `${i.toString().padStart(2, '0')}:00`;
        newSlots.push({
          venueId,
          courtId: targetCourtId,
          date: dateObj,
          startTime,
          isBooked: false,
        });
      }

      await this.prisma.timeSlot.createMany({
        data: newSlots,
      });

      slots = await this.prisma.timeSlot.findMany({
        where: { courtId: targetCourtId, date: dateObj },
        orderBy: { startTime: 'asc' },
      });

      slots = slots.filter(slot => {
        const h = parseInt(slot.startTime.split(':')[0], 10);
        return !isNaN(h) && h >= startHour && h < endHour;
      });
    }

    const closures = await this.prisma.venueClosure.findMany({
      where: { venueId, date: dateObj },
    });

    return slots.map(slot => {
      let isClosed = false;
      let closureReason: string | undefined;
      const slotH = parseInt(slot.startTime.split(':')[0], 10);

      for (const c of closures) {
        if (!c.startTime && !c.endTime) {
          isClosed = true;
          closureReason = c.reason;
          break;
        }
        const cStart = parseInt((c.startTime || '00:00').split(':')[0], 10);
        const cEnd = parseInt((c.endTime || '24:00').split(':')[0], 10);
        if (slotH >= cStart && slotH < cEnd) {
          isClosed = true;
          closureReason = c.reason;
          break;
        }
      }

      return {
        id: slot.id,
        courtId: targetCourtId,
        courtName: targetCourt.name,
        courtType: targetCourt.courtType,
        startTime: slot.startTime,
        isBooked: slot.isBooked || isClosed,
        isClosed,
        closureReason,
        price: courtPrice,
      };
    });
  }

  async adminFindAll(query: QueryVenuesDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.venue.count({ where }),
      this.prisma.venue.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { bookings: true } },
        }
      }),
    ]);

    const enhancedData = await Promise.all(data.map(async (venue) => {
        const result = await this.prisma.booking.aggregate({
            where: { venueId: venue.id, status: 'completed' },
            _sum: { total: true }
        });
        return {
            ...venue,
            totalBookings: venue._count?.bookings || 0,
            revenue: result._sum?.total || 0
        };
    }));

    return { data: enhancedData, total, page, limit };
  }

  async create(dto: CreateVenueDto) {
    return this.prisma.venue.create({ data: dto });
  }

  async update(id: string, dto: UpdateVenueDto) {
    return this.prisma.venue.update({
      where: { id },
      data: dto,
    });
  }

  async toggleStatus(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue with ID ${id} not found`);

    return this.prisma.venue.update({
      where: { id },
      data: { isActive: !venue.isActive },
    });
  }

  async remove(id: string) {
    return this.prisma.venue.delete({ where: { id } });
  }

  async createClosure(venueId: string, dto: CreateVenueClosureDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException(`Venue dengan ID ${venueId} tidak ditemukan`);

    const dateObj = new Date(dto.date + 'T00:00:00.000Z');

    return this.prisma.venueClosure.create({
      data: {
        venueId,
        date: dateObj,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        reason: dto.reason,
      },
    });
  }

  async getClosures(venueId: string) {
    return this.prisma.venueClosure.findMany({
      where: { venueId },
      orderBy: { date: 'asc' },
    });
  }

  async deleteClosure(id: string) {
    const closure = await this.prisma.venueClosure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Penutupan venue tidak ditemukan');

    return this.prisma.venueClosure.delete({ where: { id } });
  }
}
