import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin - Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  getOverviewKPIs() {
    return this.reportsService.getOverviewKPIs();
  }

  @Get('revenue')
  getRevenueTrend(@Query('months') months: string) {
    return this.reportsService.getRevenueTrend(Number(months) || 6);
  }

  @Get('bookings-by-status')
  getBookingsByStatus() {
    return this.reportsService.getBookingsByStatus();
  }

  @Get('monthly-bookings')
  getMonthlyBookings(@Query('months') months: string) {
    return this.reportsService.getMonthlyBookings(Number(months) || 6);
  }

  @Get('venue-type-split')
  getVenueTypeSplit() {
    return this.reportsService.getVenueTypeSplit();
  }

  @Get('top-venues')
  getTopVenues(@Query('limit') limit: string) {
    return this.reportsService.getTopVenues(Number(limit) || 5);
  }

  @Get('financial')
  getFinancialKPIs(@Query('period') period: string) {
    return this.reportsService.getFinancialKPIs(period || '6months');
  }
}
