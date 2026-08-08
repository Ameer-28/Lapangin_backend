import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, PrismaService, NotificationsService],
  exports: [BookingsService],
})
export class BookingsModule {}
