import { IsNotEmpty, IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourtDto {
  @ApiProperty({ description: 'Nama lapangan', example: 'Lapangan 2 (Rumput Sintetis)' })
  @IsString()
  @IsNotEmpty({ message: 'Nama lapangan tidak boleh kosong' })
  name: string;

  @ApiPropertyOptional({ description: 'Tipe permukaan lapangan', example: 'Rumput Sintetis' })
  @IsString()
  @IsOptional()
  courtType?: string;

  @ApiPropertyOptional({ description: 'Deskripsi lapangan', example: 'Rumput sintetis kualitas standar internasional' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Tarif khusus lapangan per jam (jika kosong, mengikuti tarif venue)', example: 175000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  pricePerHour?: number;

  @ApiPropertyOptional({ description: 'Status aktif operasional', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
