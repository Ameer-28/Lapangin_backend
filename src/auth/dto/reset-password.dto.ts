import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token reset password dari email / URL', example: 'a1b2c3d4...' })
  @IsString()
  @IsNotEmpty({ message: 'Token reset tidak boleh kosong' })
  token: string;

  @ApiProperty({ description: 'Password baru', example: 'NewSecurePassword123' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  newPassword: string;
}
