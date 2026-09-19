import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID Token lấy từ Google Sign-in trên Mobile',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAiLCJ0eXAiOiJKV1QifQ...',
  })
  @IsString({ message: 'Token phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Token không được để trống' })
  token: string;
}
