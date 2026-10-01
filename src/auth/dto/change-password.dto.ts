import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại' })
  @IsString()
  current_password!: string;

  @ApiProperty({ minLength: 6, description: 'Mật khẩu mới' })
  @IsString()
  @MinLength(6)
  new_password!: string;
}
