import { ApiProperty } from '@nestjs/swagger';

export class IngredientAnalysisDto {
  @ApiProperty({ example: 'Đậu phộng' })
  name: string;

  @ApiProperty({
    example: true,
    description: 'True nếu vi phạm dị ứng của user',
  })
  is_allergen: boolean;
}

export class AnalyzeFoodDataDto {
  @ApiProperty({ example: 'Phở Bò' })
  food_name_vi: string;

  @ApiProperty({ example: 'Beef Noodle Soup' })
  food_name_en: string;

  @ApiProperty({ example: 450 })
  estimated_kcal: number;

  @ApiProperty({ example: false })
  is_safe_for_user: boolean;

  @ApiProperty({ example: ['Món ăn có chứa đậu phộng'], type: [String] })
  warnings: string[];

  @ApiProperty({ type: [IngredientAnalysisDto] })
  ingredients: IngredientAnalysisDto[];
}

export class AnalyzeFoodResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Phân tích món ăn thành công' })
  message: string;

  @ApiProperty({ type: AnalyzeFoodDataDto })
  data: AnalyzeFoodDataDto;
}
