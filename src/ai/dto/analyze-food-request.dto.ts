import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AnalyzeFoodRequestDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Hình ảnh món ăn cần phân tích (jpg, png, webp)',
  })
  file: any;

  @ApiPropertyOptional({
    example: 200,
    description: 'Khối lượng món ăn thực tế (gram). Nếu có, AI sẽ tính Kcal chính xác hơn.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Khối lượng phải là một số' })
  weight_g?: number;

  @ApiPropertyOptional({
    example: 'Món này tôi ăn không cho đường và không hành',
    description: 'Ghi chú thêm cho AI để nhận diện chuẩn hơn',
  })
  @IsOptional()
  @IsString()
  additional_info?: string;
}
