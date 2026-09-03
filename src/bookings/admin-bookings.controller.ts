import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { CreateAdminBookingDto } from './dto/create-admin-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Admin - Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Admin create offline booking / manual slot block' })
  adminCreateOfflineBooking(@CurrentUser() admin: any, @Body() dto: CreateAdminBookingDto) {
    return this.bookingsService.adminCreateOfflineBooking(admin.sub, dto);
  }

  @Get()
  adminFindAll(@Query() query: QueryBookingsDto) {
    return this.bookingsService.adminFindAll(query);
  }

  @Get('stats')
  getStats() {
    return this.bookingsService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/cancel')
  adminCancel(@Param('id') id: string) {
    return this.bookingsService.adminCancel(id);
  }
}
