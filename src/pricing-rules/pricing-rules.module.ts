import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PricingRulesService } from './pricing-rules.service';
import { PricingRulesController } from './pricing-rules.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PricingRulesController],
  providers: [PricingRulesService],
  exports: [PricingRulesService],
})
export class PricingRulesModule {}
