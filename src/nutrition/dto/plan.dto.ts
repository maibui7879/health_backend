import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlanStatus } from '../entities/nutrition-plan.entity';

export class CreatePlanDto {
  @ApiPropertyOptional({ example: 'Plan giảm cân tuần 1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsDateString()
  date_from!: string;

  @ApiPropertyOptional({
    example: '2026-10-11',
    description: 'Mặc định = date_from + 6 ngày.',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal_summary?: string;

  @ApiPropertyOptional({ description: 'Snapshot TDEE/mục tiêu lúc lập plan.' })
  @IsOptional()
  @IsObject()
  goal_snapshot?: Record<string, unknown>;

  @ApiProperty({ description: 'Nguyên output suggest-plan (mảng ngày).' })
  @IsArray()
  @ArrayMinSize(1)
  items!: unknown[];
}

export class UpdatePlanDto {
  @ApiProperty({
    enum: [PlanStatus.COMPLETED, PlanStatus.ABANDONED, PlanStatus.ACTIVE],
    example: PlanStatus.COMPLETED,
  })
  @IsEnum(PlanStatus)
  status!: PlanStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class PlanQueryDto {
  @ApiPropertyOptional({
    enum: PlanStatus,
    description: 'Mặc định chỉ plan ACTIVE.',
  })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @ApiPropertyOptional({
    description: 'true = chỉ xem mẫu của tôi. Mặc định false.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  is_template?: boolean;
}

export class PublishTemplateDto {
  @ApiPropertyOptional({
    example: 'Thực đơn giảm cân 7 ngày dễ nấu',
    description: 'Bỏ trống thì giữ tiêu đề plan gốc.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: '🥗', description: '1 emoji bìa.' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cover_emoji?: string;
}

export class CloneTemplateDto {
  @ApiProperty({
    example: '2026-10-13',
    description: 'Ngày bắt đầu theo mẫu (YYYY-MM-DD).',
  })
  @IsDateString()
  start_date!: string;
}

export class TemplateQueryDto {
  @ApiPropertyOptional({ enum: ['hot', 'new'], description: 'Mặc định hot.' })
  @IsOptional()
  @IsIn(['hot', 'new'])
  sort?: 'hot' | 'new';

  @ApiPropertyOptional({ example: 20, description: 'Tối đa 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AdherenceQueryDto {
  @ApiProperty({
    example: '2026-10-06',
    description: 'Ngày cần so plan vs thực tế (YYYY-MM-DD).',
  })
  @IsDateString()
  date!: string;
}
