import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VenuesModule } from './venues/venues.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CourtsModule } from './courts/courts.module';
import { PricingRulesModule } from './pricing-rules/pricing-rules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    VenuesModule,
    BookingsModule,
    PaymentsModule,
    FavoritesModule,
    ReviewsModule,
    PromoCodesModule,
    ReportsModule,
    SettingsModule,
    NotificationsModule,
    CourtsModule,
    PricingRulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
