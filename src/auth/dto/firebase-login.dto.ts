import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FirebaseLoginDto {
  @ApiProperty({
    description: 'ID Token lấy từ Firebase SDK trên Mobile/WEB',
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1Njc4OTAiLCJ0eXAiOiJKV1QifQ...',
  })
  @IsString({ message: 'ID token phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'ID token không được để trống' })
  idToken: string;
}
