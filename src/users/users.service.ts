import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...result } = user as any;
    if (!result.fullName && result.email) {
      result.fullName = result.email.split('@')[0];
    }
    return result;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    const { passwordHash, ...result } = updated as any;
    return result;
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    
    const isMatch = await bcrypt.compare(dto.currentPassword, (user as any).passwordHash || '');
    if (!isMatch) throw new BadRequestException('Incorrect current password');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed },
    });
    return { success: true, message: 'Password updated successfully' };
  }

  async updateNotifications(userId: string, dto: UpdateNotificationsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        emailNotifications: true,
        bookingAlerts: true,
        promoNotifications: true,
      }
    });
  }

  async getUserStats(userId: string) {
    const totalBookings = await this.prisma.booking.count({ where: { userId } });
    
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: { venue: true },
    });

    const totalHoursPlayed = bookings.reduce((sum, b) => sum + (b.durationHours || 0), 0);

    const venueCounts: Record<string, { count: number; name: string }> = {};
    for (const b of bookings) {
      if (b.venue) {
        if (!venueCounts[b.venueId]) {
          venueCounts[b.venueId] = { count: 0, name: b.venue.name };
        }
        venueCounts[b.venueId].count++;
      }
    }

    let favoriteVenueName = null;
    let maxCount = 0;
    for (const vId in venueCounts) {
      if (venueCounts[vId].count > maxCount) {
        maxCount = venueCounts[vId].count;
        favoriteVenueName = venueCounts[vId].name;
      }
    }

    const reviewAgg = await this.prisma.review.aggregate({
      where: { userId },
      _avg: { rating: true },
    });
    const averageRatingGiven = reviewAgg._avg.rating || 0;

    return {
      totalBookings,
      totalHoursPlayed,
      favoriteVenueName,
      averageRatingGiven,
    };
  }

  async findAll(query: { page?: string | number, limit?: string | number, search?: string, status?: string }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            city: true,
            status: true,
            role: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          city: true,
          status: true,
          role: true,
          createdAt: true,
      }
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async toggleStatus(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const newStatus = (user as any).status === 'active' ? 'suspended' : 'active';
    return this.prisma.user.update({
      where: { id },
      data: { status: newStatus },
      select: {
          id: true,
          email: true,
          status: true,
      }
    });
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'User deleted' };
  }

  async getAdminStats() {
    const [total, active, suspended] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { status: 'suspended' } }),
    ]);
    return { total, active, suspended };
  }
}
