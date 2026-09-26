import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty()
  conversation_id!: string;

  @ApiProperty()
  reply!: string;

  @ApiProperty({ type: [String] })
  suggested_questions!: string[];

  @ApiProperty({ required: false, nullable: true })
  tokens_used!: number | null;
}
