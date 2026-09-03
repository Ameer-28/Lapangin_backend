import { Controller, Get, Param } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Courts')
@Controller()
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get('venues/:venueId/courts')
  @ApiOperation({ summary: 'Get all active courts for a specific venue' })
  findAllByVenue(@Param('venueId') venueId: string) {
    return this.courtsService.findAllByVenue(venueId, false);
  }

  @Get('courts/:id')
  @ApiOperation({ summary: 'Get court details by ID' })
  findOne(@Param('id') id: string) {
    return this.courtsService.findOne(id);
  }
}
