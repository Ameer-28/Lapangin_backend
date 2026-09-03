import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto } from './dto/query-venues.dto';
import { CreateVenueClosureDto } from './dto/create-venue-closure.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin - Venues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/venues')
export class AdminVenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all venues (including inactive) with stats' })
  adminFindAll(@Query() query: QueryVenuesDto) {
    return this.venuesService.adminFindAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new venue' })
  create(@Body() createVenueDto: CreateVenueDto) {
    return this.venuesService.create(createVenueDto);
  }

  @Post(':id/closures')
  @ApiOperation({ summary: 'Create an operational closure for a venue' })
  createClosure(
    @Param('id') venueId: string,
    @Body() dto: CreateVenueClosureDto,
  ) {
    return this.venuesService.createClosure(venueId, dto);
  }

  @Get(':id/closures')
  @ApiOperation({ summary: 'Get all operational closures for a venue' })
  getClosures(@Param('id') venueId: string) {
    return this.venuesService.getClosures(venueId);
  }

  @Delete('closures/:closureId')
  @ApiOperation({ summary: 'Delete an operational closure' })
  deleteClosure(@Param('closureId') closureId: string) {
    return this.venuesService.deleteClosure(closureId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing venue' })
  update(@Param('id') id: string, @Body() updateVenueDto: UpdateVenueDto) {
    return this.venuesService.update(id, updateVenueDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle venue active status' })
  toggleStatus(@Param('id') id: string) {
    return this.venuesService.toggleStatus(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a venue' })
  remove(@Param('id') id: string) {
    return this.venuesService.remove(id);
  }
}
