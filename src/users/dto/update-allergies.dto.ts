import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateAllergiesDto {
  @ApiProperty({
    example: ['sữa', 'đậu phộng', 'hải sản'],
    description: 'Danh sách tên các chất dị ứng của người dùng',
  })
  @IsArray()
  @IsString({ each: true })
  allergies: string[];
}
