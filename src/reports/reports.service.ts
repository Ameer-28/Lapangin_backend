import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getOverviewKPIs() {
    const totalBookings = await this.prisma.booking.count();
    const totalUsers = await this.prisma.user.count();
    const totalVenues = await this.prisma.venue.count();
    const revenueResult = await this.prisma.booking.aggregate({
      where: { status: 'completed' },
      _sum: { total: true },
    });
    const totalRevenue = revenueResult._sum.total || 0;

    return { totalRevenue, totalBookings, totalUsers, totalVenues };
  }

  async getRevenueTrend(months: number) {
    const trend = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const result = await this.prisma.booking.aggregate({
        where: {
          status: 'completed',
          createdAt: { gte: start, lte: end },
        },
        _sum: { total: true },
        _count: { id: true },
      });
      
      trend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        revenue: result._sum.total || 0,
        bookings: result._count.id || 0,
      });
    }
    return trend;
  }

  async getBookingsByStatus() {
    const upcoming = await this.prisma.booking.count({ where: { status: 'upcoming' } });
    const completed = await this.prisma.booking.count({ where: { status: 'completed' } });
    const cancelled = await this.prisma.booking.count({ where: { status: 'cancelled' } });
    
    return { upcoming, completed, cancelled };
  }

  async getMonthlyBookings(months: number) {
    const trend = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const count = await this.prisma.booking.count({
        where: { createdAt: { gte: start, lte: end } },
      });
      
      trend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        count,
      });
    }
    return trend;
  }

  async getVenueTypeSplit() {
    const indoor = await this.prisma.venue.count({ where: { type: 'Indoor' } });
    const outdoor = await this.prisma.venue.count({ where: { type: 'Outdoor' } });
    
    return { indoor, outdoor };
  }

  async getTopVenues(limit: number) {
    const venues = await this.prisma.venue.findMany({
      include: { bookings: { where: { status: 'completed' } } },
    });
    
    let totalAllRevenue = 0;
    const stats = venues.map(v => {
      const revenue = v.bookings.reduce((sum, b) => sum + (b.total || 0), 0);
      totalAllRevenue += revenue;
      return {
        id: v.id,
        name: v.name,
        totalBookings: v.bookings.length,
        revenue,
      };
    });
    
    stats.sort((a, b) => b.revenue - a.revenue);
    const top = stats.slice(0, limit).map(s => ({
      ...s,
      percentage: totalAllRevenue > 0 ? (s.revenue / totalAllRevenue) * 100 : 0,
    }));
    
    return top;
  }

  async getFinancialKPIs(period: string) {
    const totalCount = await this.prisma.booking.count();
    const completedResult = await this.prisma.booking.aggregate({
      where: { status: 'completed' },
      _sum: { total: true },
      _count: { id: true },
    });
    const cancelledCount = await this.prisma.booking.count({ where: { status: 'cancelled' } });
    
    const grossRevenue = completedResult._sum.total || 0;
    const netRevenue = grossRevenue * 0.98; // assuming 2% platform fee
    const completedCount = completedResult._count.id || 0;
    const avgBookingValue = completedCount > 0 ? grossRevenue / completedCount : 0;
    const cancellationRate = totalCount > 0 ? (cancelledCount / totalCount) * 100 : 0;
    
    return { grossRevenue, netRevenue, avgBookingValue, cancellationRate };
  }
}
