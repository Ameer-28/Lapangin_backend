import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const existingReview = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });

    if (existingReview) {
      throw new BadRequestException('A review for this booking already exists');
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
}
