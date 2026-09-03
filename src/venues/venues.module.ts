import { Module } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';
import { AdminVenuesController } from './admin-venues.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';

@Module({
  imports: [PricingRulesModule],
  controllers: [VenuesController, AdminVenuesController],
  providers: [VenuesService, PrismaService, PricingRulesService],
  exports: [VenuesService],
})
export class VenuesModule {}
