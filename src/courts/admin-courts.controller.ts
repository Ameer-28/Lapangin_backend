import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin - Courts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminCourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get('venues/:venueId/courts')
  @ApiOperation({ summary: 'Get all courts (active & inactive) for a venue' })
  findAllByVenue(@Param('venueId') venueId: string) {
    return this.courtsService.findAllByVenue(venueId, true);
  }

  @Post('venues/:venueId/courts')
  @ApiOperation({ summary: 'Create a new court for a venue' })
  create(
    @Param('venueId') venueId: string,
    @Body() dto: CreateCourtDto,
  ) {
    return this.courtsService.create(venueId, dto);
  }

  @Patch('courts/:id')
  @ApiOperation({ summary: 'Update court details & pricing' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourtDto,
  ) {
    return this.courtsService.update(id, dto);
  }

  @Patch('courts/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle court active/inactive status' })
  toggleStatus(@Param('id') id: string) {
    return this.courtsService.toggleStatus(id);
  }

  @Delete('courts/:id')
  @ApiOperation({ summary: 'Delete court' })
  remove(@Param('id') id: string) {
    return this.courtsService.remove(id);
  }
}
