import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVenueClosureDto {
  @ApiProperty({ description: 'Tanggal penutupan (YYYY-MM-DD)', example: '2026-09-15' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @ApiPropertyOptional({ description: 'Jam mulai penutupan (HH:00, kosongkan jika tutup seharian)', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'StartTime must be in HH:00 format' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Jam selesai penutupan (HH:00, kosongkan jika tutup seharian)', example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'EndTime must be in HH:00 format' })
  endTime?: string;

  @ApiProperty({ description: 'Alasan penutupan operasional (misal: Maintenance Lapangan, Libur Hari Raya, Renovasi Rumput)', example: 'Pemeliharaan Lampu & Jaring' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
