import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '../../nutrition/entities/meal.entity';

export class SuggestMenuItemDto {
  @ApiProperty({ example: 'Cơm gạo lứt + ức gà áp chảo' })
  food_name_vi!: string;

  @ApiPropertyOptional({ example: 'Brown rice with grilled chicken breast' })
  food_name_en?: string;

  @ApiProperty({ example: 550 })
  estimated_kcal!: number;

  @ApiPropertyOptional({ example: 'Giàu đạm, ít dầu mỡ, hợp mục tiêu giảm cân' })
  reason?: string;
}

export class SuggestMenuDataDto {
  @ApiProperty({
    enum: MealType,
    example: MealType.LUNCH,
    description: 'Bữa được gợi ý (hoặc bữa chính đại diện khi gợi ý cả ngày)',
  })
  meal_type!: MealType;

  @ApiProperty({ example: 1650 })
  total_kcal!: number;

  @ApiProperty({ type: [SuggestMenuItemDto] })
  items!: SuggestMenuItemDto[];
}

export class SuggestMenuResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Gợi ý thực đơn thành công' })
  message!: string;

  @ApiProperty({ type: SuggestMenuDataDto })
  data!: SuggestMenuDataDto;
}
