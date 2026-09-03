import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RescheduleBookingDto {
  @ApiProperty({ description: 'Tanggal baru (YYYY-MM-DD)', example: '2026-09-10' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  newDate: string;

  @ApiProperty({ description: 'Jam mulai baru (HH:00)', example: '20:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'StartTime must be in HH:00 format' })
  newStartTime: string;

  @ApiPropertyOptional({ description: 'Alasan reschedule / catatan admin', example: 'Permintaan customer via telepon' })
  @IsString()
  @IsOptional()
  reason?: string;
}
