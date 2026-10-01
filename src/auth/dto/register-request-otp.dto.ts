import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterRequestOtpDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsNotEmpty()
  @IsString()
  full_name!: string;

  @ApiProperty({ example: 'user@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6, format: 'password', writeOnly: true })
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
