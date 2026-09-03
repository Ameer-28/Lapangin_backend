import { IsString, IsOptional, IsArray, IsInt, IsBoolean, Matches, Min, Max, ArrayUnique } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePricingRuleDto {
  @ApiProperty({ description: 'Rule name', example: 'Peak Evening' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Court ID (null = all courts)', example: null })
  @IsOptional()
  @IsString()
  courtId?: string;

  @ApiProperty({ description: 'Days of week (0=Sun..6=Sat). Empty = all days', example: [5, 6] })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  dayOfWeek: number[];

  @ApiProperty({ description: 'Start time (HH:mm)', example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:mm)', example: '22:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Price per hour in IDR', example: 200000 })
  @IsInt()
  @Min(0)
  pricePerHour: number;

  @ApiPropertyOptional({ description: 'Priority (higher wins)', example: 10, default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: 'Whether rule is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
