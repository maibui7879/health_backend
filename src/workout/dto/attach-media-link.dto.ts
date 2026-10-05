import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, MaxLength } from 'class-validator';

export class AttachMediaLinkDto {
  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=...',
    description: 'Link video ngoài (YouTube). Embed qua player của FE.',
  })
  @IsUrl()
  @MaxLength(500)
  media_url!: string;
}
