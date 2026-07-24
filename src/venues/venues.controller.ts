import { Controller, Get, Param, Query } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active venues with pagination and filtering' })
  findAll(@Query() query: QueryVenuesDto) {
    return this.venuesService.findAll(query);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get top 3 featured venues' })
  findFeatured() {
    return this.venuesService.findFeatured();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get venue details by ID' })
  findOne(@Param('id') id: string) {
    return this.venuesService.findOne(id);
  }

  @Get(':id/time-slots')
  @ApiOperation({ summary: 'Get time slots for a venue on a specific date' })
  getTimeSlots(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.venuesService.getTimeSlots(id, date);
  }
}
