import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChatRequestDto {
  @ApiProperty({ example: 'Tối nay tôi nên ăn gì với 500kcal còn lại?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Bỏ trống để tạo hội thoại mới' })
  @IsOptional()
  @IsUUID()
  conversation_id?: string;
}
