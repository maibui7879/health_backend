import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MealType } from '../entities/meal.entity';

export class SearchHistoryDto {
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Tìm từ ngày' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-12', description: 'Đến ngày' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'tôm hùm', description: 'Tìm theo tên món ăn' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    enum: MealType,
    example: MealType.PRE_WORKOUT,
    description: 'Lọc theo bữa (Sáng/Trưa/Tối/Ăn vặt/Pre/Post Workout)',
  })
  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;
}
