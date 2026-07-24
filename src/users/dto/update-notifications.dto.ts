import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  bookingAlerts?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  promoNotifications?: boolean;
}
