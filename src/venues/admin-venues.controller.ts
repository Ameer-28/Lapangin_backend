import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenuesDto } from './dto/query-venues.dto';
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
