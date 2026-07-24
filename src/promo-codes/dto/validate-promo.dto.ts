import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidatePromoDto {
  @ApiProperty({ description: 'The promo code string to validate' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
