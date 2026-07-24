import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiProperty({ description: 'The unique identifier of the booking' })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ description: 'Payment method used', enum: ['credit_card', 'bank_transfer', 'qris', 'ewallet'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['credit_card', 'bank_transfer', 'qris', 'ewallet'])
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Payment detail (e.g. BCA VA, GoPay)' })
  @IsString()
  @IsOptional()
  paymentDetail?: string;
}
