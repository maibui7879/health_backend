import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
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

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=...',
    description: 'Link media ngoài (VD: YouTube). Bỏ trống nếu upload file.',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  media_url?: string;

  @ApiPropertyOptional({
    example: 'youtube',
    description: "Loại media ngoài: 'youtube'. Upload file thì BE tự set.",
  })
  @IsOptional()
  @IsIn(['youtube'])
  media_type?: string;

  @ApiPropertyOptional({
    description:
      'ID template mẫu đã chọn (GET /workouts/templates). Custom thì bỏ trống.',
  })
  @IsOptional()
  @IsUUID()
  template_id?: string;
}
