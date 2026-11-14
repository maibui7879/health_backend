import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  Max,
  MaxLength,
  Min,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHT = 'LIGHT',
  MODERATE = 'MODERATE',
  ACTIVE = 'ACTIVE',
}

export enum GoalType {
  LOSE_WEIGHT = 'LOSE_WEIGHT',
  MAINTAIN = 'MAINTAIN',
  GAIN_MUSCLE = 'GAIN_MUSCLE',
}

export enum DietType {
  STANDARD = 'STANDARD',
  VEGAN = 'VEGAN',
  VEGETARIAN = 'VEGETARIAN',
  KETO = 'KETO',
  PALEO = 'PALEO',
  HALAL = 'HALAL',
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'],
  })
  @IsOptional()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'])
  blood_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  activity_habits?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  medical_conditions?: string[];

  @ApiPropertyOptional({
    description:
      'Có hạn chế nước theo chỉ định, mang thai hoặc tình trạng cần tư vấn riêng.',
  })
  @IsOptional()
  @IsBoolean()
  hydration_restricted?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['water'] })
  @IsOptional()
  @IsArray()
  @IsIn(['nutrition', 'water', 'workout', 'community'], { each: true })
  enabled_modules?: string[];

  @ApiPropertyOptional({
    enum: ['MIFFLIN_ST_JEOR', 'HARRIS_BENEDICT', 'ROZA_SHIZGAL'],
  })
  @IsOptional()
  @IsIn(['MIFFLIN_ST_JEOR', 'HARRIS_BENEDICT', 'ROZA_SHIZGAL'])
  bmr_formula?: string;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional({ example: '1999-01-01' })
  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @ApiPropertyOptional({ example: 'MALE' })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: string;

  @ApiPropertyOptional({ example: 170 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  height_cm?: number;

  @ApiPropertyOptional({ example: 65 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  current_weight_kg?: number;

  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activity_level?: string;

  @ApiPropertyOptional({ enum: GoalType })
  @IsOptional()
  @IsEnum(GoalType)
  goal_type?: string;

  @ApiPropertyOptional({ enum: DietType, example: DietType.VEGAN })
  @IsOptional()
  @IsEnum(DietType)
  diet_type?: string;

  @ApiPropertyOptional({
    example: '/uploads/avatars/<user-id>-1234567890.jpg',
    description:
      'URL ảnh đại diện (ưu tiên dùng POST /users/avatar để upload file).',
  })
  @IsOptional()
  @IsString()
  avatar_url?: string;
}
