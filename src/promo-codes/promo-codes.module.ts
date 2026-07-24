import { Module } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { PromoCodesController } from './promo-codes.controller';
import { AdminPromoCodesController } from './admin-promo-codes.controller';

@Module({
  controllers: [PromoCodesController, AdminPromoCodesController],
  providers: [PromoCodesService],
})
export class PromoCodesModule {}
