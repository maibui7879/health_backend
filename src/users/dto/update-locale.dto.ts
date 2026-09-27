import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateLocaleDto {
  @ApiProperty({
    example: 'en',
    description: 'Ngôn ngữ hiển thị của user: vi | en',
  })
  @IsIn(['vi', 'en'])
  locale!: string;
}
