import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin - Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin list and moderate customer reviews' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'rating', required: false, type: Number })
  @ApiQuery({ name: 'venueId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('rating') rating?: string,
    @Query('venueId') venueId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.adminFindAll({
      search,
      rating: rating ? +rating : undefined,
      venueId,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin delete an inappropriate review' })
  deleteReview(@Param('id') id: string) {
    return this.reviewsService.adminDelete(id);
  }
}
