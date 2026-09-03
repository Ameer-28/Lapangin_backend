import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PricingRulesService } from './pricing-rules.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin Pricing Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller()
export class PricingRulesController {
  constructor(private readonly pricingRulesService: PricingRulesService) {}

  @Get('admin/venues/:venueId/pricing-rules')
  @ApiOperation({ summary: 'List all pricing rules for a venue' })
  async findAll(@Param('venueId') venueId: string) {
    return this.pricingRulesService.findAllByVenue(venueId);
  }

  @Post('admin/venues/:venueId/pricing-rules')
  @ApiOperation({ summary: 'Create a pricing rule for a venue' })
  async create(
    @Param('venueId') venueId: string,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.pricingRulesService.create(venueId, dto);
  }

  @Patch('admin/pricing-rules/:id')
  @ApiOperation({ summary: 'Update a pricing rule' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingRulesService.update(id, dto);
  }

  @Patch('admin/pricing-rules/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle pricing rule active/inactive' })
  async toggleStatus(@Param('id') id: string) {
    return this.pricingRulesService.toggleStatus(id);
  }

  @Delete('admin/pricing-rules/:id')
  @ApiOperation({ summary: 'Delete a pricing rule' })
  async remove(@Param('id') id: string) {
    return this.pricingRulesService.remove(id);
  }
}
