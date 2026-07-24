import { IsUUID, IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  venueId: string;

  @ApiProperty({ example: '2023-12-01' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 4 })
  @IsNumber()
  @Min(1)
  @Max(4)
  durationHours: number;

  @ApiPropertyOptional({ example: 'PROMO10' })
  @IsString()
  @IsOptional()
  promoCode?: string;

  @ApiProperty({ example: 'credit_card', enum: ['credit_card', 'bank_transfer', 'qris', 'ewallet'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['credit_card', 'bank_transfer', 'qris', 'ewallet'])
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'BCA VA' })
  @IsString()
  @IsOptional()
  paymentDetail?: string;
}
