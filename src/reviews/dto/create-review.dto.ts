import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'The unique identifier of the booking' })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ description: 'Rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiPropertyOptional({ description: 'Review comment' })
  @IsString()
  @IsOptional()
  comment?: string;
}
