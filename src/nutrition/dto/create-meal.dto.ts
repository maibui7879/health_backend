import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '../entities/meal.entity';

export class MealItemDto {
  @ApiProperty({ example: 'Tôm hùm nướng' })
  @IsString()
  food_name_vi!: string;

  @ApiPropertyOptional({ example: 'Grilled Lobster' })
  @IsString()
  food_name_en?: string;

  @ApiProperty({ example: 550 })
  @IsNumber()
  estimated_kcal!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_allergen!: boolean;

  @ApiPropertyOptional({ example: ['Món ăn chứa hải sản'] })
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];
}

export class CreateMealDto {
  @ApiProperty({ example: '2026-09-12' })
  @IsDateString()
  date!: string;

  @ApiProperty({
    enum: MealType,
    example: MealType.PRE_WORKOUT,
    description: 'Loại bữa ăn: Sáng, Trưa, Tối, Ăn vặt, Pre/ Post Workout',
  })
  @IsEnum(MealType)
  meal_type!: MealType;

  @ApiProperty({ type: [MealItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items!: MealItemDto[];
}
