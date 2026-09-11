import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'Nguyen Van A',
    description: 'Họ và tên người dùng',
  })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString({ message: 'Họ và tên phải là chuỗi văn bản' })
  full_name: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Địa chỉ email',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @ApiProperty({
    example: 'secret123',
    minLength: 6,
    description: 'Mật khẩu đăng nhập',
    format: 'password',
    writeOnly: true,
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;
}