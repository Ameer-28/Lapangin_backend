import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AdminBookingsController } from './admin-bookings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';

@Module({
  imports: [NotificationsModule, PricingRulesModule],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService, PrismaService, NotificationsService, PricingRulesService],
  exports: [BookingsService],
})
export class BookingsModule {}
