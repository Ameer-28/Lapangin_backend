import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService, private readonly notificationsService: NotificationsService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        venue: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${dto.bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only review your own bookings');
    }

    if (booking.status !== 'completed') {
      throw new BadRequestException('You can only review completed bookings');
    }

    // Check if this user has already reviewed THIS VENUE (1 review per user per venue)
    const existingVenueReview = await this.prisma.review.findFirst({
      where: {
        userId: userId,
        venueId: booking.venueId,
      },
    });

    if (existingVenueReview) {
      throw new BadRequestException('Anda sudah pernah memberikan rating untuk venue ini. Satu user hanya bisa memberi satu rating per venue.');
    }

    // Also check per booking (safety net)
    const existingBookingReview = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });

    if (existingBookingReview) {
      throw new BadRequestException('Review untuk booking ini sudah ada.');
    }

    const review = await this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        userId: userId,
        venueId: booking.venueId,
        bookingId: dto.bookingId,
      },
    });

    // Update venue's average rating and review count
    const venueStats = await this.prisma.review.aggregate({
      where: { venueId: booking.venueId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.venue.update({
      where: { id: booking.venueId },
      data: {
        rating: venueStats._avg.rating || 0,
        reviewCount: venueStats._count.id || 0,
      },
    });

    try {
      await this.notificationsService.createNotification(
        userId,
        'Review Terkirim! ⭐',
        `Terima kasih telah memberikan rating ${dto.rating} bintang untuk ${booking.venue.name}.`,
        'review'
      );
    } catch (e) {}

    return review;
  }

  async findByVenue(venueId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { venueId },
        include: {
          user: {
            select: {
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { venueId } }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviewedVenueIds(userId: string): Promise<string[]> {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      select: { venueId: true },
      distinct: ['venueId'],
    });
    return reviews.map(r => r.venueId);
  }

  async findRecent(limit: number = 6) {
    return this.prisma.review.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
        venue: {
          select: {
            name: true,
            city: true,
          },
        },
      },
    });
  }

  async adminFindAll(query: {
    search?: string;
    rating?: number;
    venueId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ? +query.page : 1;
    const limit = query.limit ? +query.limit : 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.rating) {
      where.rating = +query.rating;
    }
    if (query.venueId) {
      where.venueId = query.venueId;
    }
    if (query.search) {
      where.OR = [
        { comment: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { venue: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatarUrl: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingCode: true,
              date: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async adminDelete(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review dengan ID ${id} tidak ditemukan`);
    }

    await this.prisma.review.delete({
      where: { id },
    });

    // Recalculate venue rating and review count
    const venueStats = await this.prisma.review.aggregate({
      where: { venueId: review.venueId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await this.prisma.venue.update({
      where: { id: review.venueId },
      data: {
        rating: venueStats._avg.rating || 0,
        reviewCount: venueStats._count.id || 0,
      },
    });

    return { message: 'Review berhasil dihapus', id };
  }
}
