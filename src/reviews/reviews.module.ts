import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, NotificationsService, PrismaService],
})
export class ReviewsModule {}
