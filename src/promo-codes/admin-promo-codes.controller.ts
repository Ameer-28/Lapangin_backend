import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Admin - Promo Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/promo-codes')
export class AdminPromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all promo codes (Admin)' })
  findAll() {
    return this.promoCodesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new promo code (Admin)' })
  create(@Body() createPromoCodeDto: CreatePromoCodeDto) {
    return this.promoCodesService.create(createPromoCodeDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promo code (Admin)' })
  update(@Param('id') id: string, @Body() updateData: Partial<CreatePromoCodeDto> & { isActive?: boolean }) {
    return this.promoCodesService.update(id, updateData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promo code (Admin)' })
  remove(@Param('id') id: string) {
    return this.promoCodesService.remove(id);
  }
}
