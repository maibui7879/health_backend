import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 chữ số' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  new_password!: string;
}
