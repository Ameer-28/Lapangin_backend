import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all favorite venues for current user' })
  findAllByUser(@CurrentUser() user: any) {
    return this.favoritesService.findAllByUser(user.sub);
  }

  @Post(':venueId')
  @ApiOperation({ summary: 'Add a venue to favorites' })
  add(@CurrentUser() user: any, @Param('venueId') venueId: string) {
    return this.favoritesService.add(user.sub, venueId);
  }

  @Delete(':venueId')
  @ApiOperation({ summary: 'Remove a venue from favorites' })
  remove(@CurrentUser() user: any, @Param('venueId') venueId: string) {
    return this.favoritesService.remove(user.sub, venueId);
  }

  @Get(':venueId/check')
  @ApiOperation({ summary: 'Check if a venue is favorited by current user' })
  isFavorite(@CurrentUser() user: any, @Param('venueId') venueId: string) {
    return this.favoritesService.isFavorite(user.sub, venueId);
  }
}
