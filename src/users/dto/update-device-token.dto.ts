import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDeviceTokenDto {
  @ApiProperty({ example: 'fcm-token-chuoi-dai-dang-nhap-tu-dien-thoai' })
  @IsString()
  @IsNotEmpty()
  device_token: string;
}
