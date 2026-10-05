import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SemanticSearchDto {
  @ApiProperty({
    example: 'món nào giống phở bò mà ít calo hơn',
    description: 'Câu hỏi tự nhiên (vi/en).',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional({ example: 150, description: 'Lọc kcal/100g tối đa.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_kcal?: number;

  @ApiPropertyOptional({ example: 10, description: 'Tối đa 30.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
