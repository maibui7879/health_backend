import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class UpdateAllergiesDto {
  @ApiProperty({
    example: ['en:milk', 'en:peanuts'],
    description: 'Danh sách các mã dị ứng từ hệ thống',
  })
  @IsArray()
  @IsString({ each: true })
  allergen_codes: string[];
}
