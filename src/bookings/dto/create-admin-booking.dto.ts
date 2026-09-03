import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdminBookingDto {
  @ApiProperty({ description: 'ID venue yang dibooking' })
  @IsString()
  @IsNotEmpty()
  venueId: string;

  @ApiProperty({ description: 'Tanggal booking (format YYYY-MM-DD)', example: '2026-09-04' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ description: 'Jam mulai (format HH:00)', example: '19:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):00$/, { message: 'StartTime must be in HH:00 format' })
  startTime: string;

  @ApiProperty({ description: 'Durasi sewa dalam jam', example: 2 })
  @IsNumber()
  @Min(1)
  durationHours: number;

  @ApiProperty({ description: 'Nama pemesan offline / keperluan (misal: Budi (WA), Maintenance)', example: 'Budi (Offline/WA)' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiPropertyOptional({ description: 'Nomor telepon pemesan offline', example: '081234567890' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Metode pembayaran', example: 'cash' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Status pembayaran', example: 'paid' })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Custom total harga (opsional, jika kosong dihitung dari harga per jam venue)', example: 250000 })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Catatan tambahan', example: 'DP 100k via kasir' })
  @IsString()
  @IsOptional()
  notes?: string;
}
