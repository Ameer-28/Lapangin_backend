import { IsNotEmpty, IsString, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePromoCodeDto {
  @ApiProperty({ description: 'The promo code string' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Discount percentage from 0 to 100' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  discountPct: number;

  @ApiProperty({ description: 'Valid from date' })
  @IsDateString()
  @IsNotEmpty()
  validFrom: string | Date;

  @ApiProperty({ description: 'Valid until date' })
  @IsDateString()
  @IsNotEmpty()
  validUntil: string | Date;

  @ApiProperty({ description: 'Maximum uses allowed' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  maxUses: number;
}
