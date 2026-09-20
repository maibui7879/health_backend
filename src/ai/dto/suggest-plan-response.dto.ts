import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanMealDto {
  @ApiProperty({ example: 'BREAKFAST' })
  meal_type!: string;

  @ApiProperty({ example: 'Yến mạch sữa chua Hy Lạp + chuối' })
  suggestion!: string;

  @ApiProperty({ example: 380 })
  kcal!: number;
}

export class PlanWorkoutDto {
  @ApiProperty({ example: 'Đi bộ nhanh' })
  activity!: string;

  @ApiProperty({ example: 30 })
  duration_minutes!: number;

  @ApiPropertyOptional({ example: 'Giữ nhịp tim vừa phải, uống đủ nước' })
  note?: string;
}

export class PlanDayDto {
  @ApiProperty({ example: 1 })
  day!: number;

  @ApiProperty({ type: [PlanMealDto] })
  meals!: PlanMealDto[];

  @ApiPropertyOptional({ type: PlanWorkoutDto })
  workout?: PlanWorkoutDto;

  @ApiPropertyOptional({ example: 'Ngủ đủ 7 tiếng để phục hồi cơ' })
  tip?: string;
}

export class SuggestPlanDataDto {
  @ApiProperty({ example: 7 })
  duration_days!: number;

  @ApiProperty({ example: 'Giảm ~0.5kg/tuần với thâm hụt 500 kcal/ngày' })
  goal_summary!: string;

  @ApiPropertyOptional({
    example: 8,
    description: 'Số tuần ước tính để đạt mục tiêu (nếu tính được)',
  })
  estimated_weeks?: number;

  @ApiProperty({ type: [PlanDayDto] })
  days!: PlanDayDto[];
}

export class SuggestPlanResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Gợi ý kế hoạch thành công' })
  message!: string;

  @ApiProperty({ type: SuggestPlanDataDto })
  data!: SuggestPlanDataDto;
}
