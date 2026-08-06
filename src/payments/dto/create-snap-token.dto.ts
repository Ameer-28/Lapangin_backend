import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSnapTokenDto {
  @ApiProperty({ description: 'The unique identifier of the booking to pay' })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;
}
