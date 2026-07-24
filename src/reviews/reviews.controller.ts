import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  @ApiOperation({ summary: 'Create a review for a booking' })
  create(@CurrentUser() user: any, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, createReviewDto);
  }

  @Get('venues/:venueId/reviews')
  @ApiOperation({ summary: 'Get paginated reviews for a venue' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findByVenue(
    @Param('venueId') venueId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.findByVenue(venueId, page ? +page : 1, limit ? +limit : 10);
  }
}
