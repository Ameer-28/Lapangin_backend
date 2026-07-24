import { Module } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';
import { AdminVenuesController } from './admin-venues.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [VenuesController, AdminVenuesController],
  providers: [VenuesService, PrismaService],
  exports: [VenuesService],
})
export class VenuesModule {}
