import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MealType } from '../../nutrition/entities/meal.entity';

export class SuggestMenuRequestDto {
  @ApiPropertyOptional({
    example: '2026-09-20',
    description: 'Ngày áp dụng thực đơn (YYYY-MM-DD). Mặc định là hôm nay.',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    enum: MealType,
    example: MealType.LUNCH,
    description: 'Bữa cần gợi ý. Bỏ trống để gợi ý cả ngày.',
  })
  @IsOptional()
  @IsEnum(MealType)
  meal_type?: MealType;

  @ApiPropertyOptional({
    example: 600,
    description:
      'Mục tiêu Kcal cho bữa (hoặc cả ngày nếu không chọn bữa). Mặc định lấy từ hồ sơ người dùng.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kcal_target?: number;

  @ApiPropertyOptional({
    example: 'Không ăn cay, ưu tiên món luộc/hấp',
    description: 'Yêu cầu cụ thể thêm cho AI khi gợi ý thực đơn.',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
