import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFavoriteDto {
  @ApiPropertyOptional({
    description: 'ID món trong catalog. Bỏ trống nếu món tự nhập.',
  })
  @IsOptional()
  @IsUUID()
  food_id?: string;

  @ApiPropertyOptional({ example: 'Phở bò tái' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  food_name_vi?: string;

  @ApiPropertyOptional({ example: 'Rare beef pho' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  food_name_en?: string;

  @ApiPropertyOptional({ example: 95 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kcal_100g?: number;

  @ApiPropertyOptional({ example: 6.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  protein_100g?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs_100g?: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fat_100g?: number;

  @ApiPropertyOptional({ example: 'Ăn sáng thứ 2-4-6' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
