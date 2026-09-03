import { Module } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CourtsController } from './courts.controller';
import { AdminCourtsController } from './admin-courts.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [CourtsController, AdminCourtsController],
  providers: [CourtsService, PrismaService],
  exports: [CourtsService],
})
export class CourtsModule {}
