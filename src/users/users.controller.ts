import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Update password' })
  updatePassword(
    @CurrentUser() user: any,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.sub, dto);
  }

  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(
    @CurrentUser() user: any,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.usersService.updateNotifications(user.sub, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get user stats' })
  getUserStats(@CurrentUser() user: any) {
    return this.usersService.getUserStats(user.sub);
  }
}
