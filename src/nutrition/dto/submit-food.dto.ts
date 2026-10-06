import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitFoodDto {
  @ApiPropertyOptional({ example: 'Bún đậu mắm tôm chay' })
  @IsString()
  @MaxLength(255)
  food_name_vi!: string;

  @ApiPropertyOptional({ example: 'Vegan noodle platter' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  food_name_en?: string;

  @ApiPropertyOptional({ example: 160 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kcal_100g?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  protein_100g?: number;

  @ApiPropertyOptional({ example: 17 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs_100g?: number;

  @ApiPropertyOptional({ example: 6.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fat_100g?: number;

  @ApiPropertyOptional({ description: 'Link ảnh minh họa (nếu có).' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  image_url?: string;

  @ApiPropertyOptional({ example: 'Món chay quán gần nhà' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
