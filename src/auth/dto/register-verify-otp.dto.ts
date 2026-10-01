import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class RegisterVerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 chữ số' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}
