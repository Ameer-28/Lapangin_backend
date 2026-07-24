import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { ValidatePromoDto } from './dto/validate-promo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Promo Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate a promo code' })
  validate(@Body() validatePromoDto: ValidatePromoDto) {
    return this.promoCodesService.validate(validatePromoDto.code);
  }
}
