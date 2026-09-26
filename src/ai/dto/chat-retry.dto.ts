import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ChatRetryDto {
  @ApiProperty({ description: 'Hội thoại cần sinh lại câu trả lời' })
  @IsUUID()
  conversation_id!: string;
}
