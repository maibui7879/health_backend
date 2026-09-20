import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanMealDto {
  @ApiProperty({ example: 'BREAKFAST' })
  meal_type!: string;

  @ApiProperty({ example: 'Yến mạch sữa chua Hy Lạp + chuối' })
  suggestion!: string;

  @ApiProperty({ example: 380 })
  kcal!: number;
}

export class PlanExerciseDto {
  @ApiProperty({ example: 'Squat với tạ đơn' })
  name!: string;

  @ApiProperty({ example: 3 })
  sets!: number;

  @ApiProperty({ example: '12 reps' })
  reps!: string;

  @ApiPropertyOptional({ example: 60 })
  rest_seconds?: number;
}

export class PlanWorkoutDto {
  @ApiProperty({ example: 'Tập thân dưới' })
  focus!: string;

  @ApiProperty({ example: 'Vừa' })
  intensity!: string;

  @ApiProperty({ example: 45 })
  duration_minutes!: number;

  @ApiPropertyOptional({ example: 220 })
  estimated_kcal_burn?: number;

  @ApiProperty({ example: 'Xoay khớp + đi bộ nhanh 5 phút' })
  warmup!: string;

  @ApiProperty({ type: [PlanExerciseDto] })
  exercises!: PlanExerciseDto[];

  @ApiProperty({ example: 'Giãn cơ đùi, bắp chân 5 phút' })
  cooldown!: string;

  @ApiPropertyOptional({ example: 'Uống nước giữa các hiệp' })
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
