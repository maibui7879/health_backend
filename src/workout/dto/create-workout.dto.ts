import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsPositive } from 'class-validator';
import { ActivityType } from '../entities/workout.entity';

export class CreateWorkoutDto {
  @ApiProperty({
    enum: ActivityType,
    example: ActivityType.RUNNING,
    description: 'Loại hoạt động: Chạy bộ, Đạp xe, Tập tạ, Yoga, Bơi, Cardio',
  })
  @IsEnum(ActivityType)
  activity_type: ActivityType;

  @ApiProperty({ example: 30, description: 'Thời lượng tập tính bằng phút' })
  @IsNumber()
  @IsPositive()
  duration_minutes: number;

  @ApiProperty({ example: 350, description: 'Số calo đã đốt cháy' })
  @IsNumber()
  @IsPositive()
  burned_kcal: number;

  @ApiProperty({ example: '2026-09-13', description: 'Ngày tập YYYY-MM-DD' })
  @IsDateString()
  date: string;
}
