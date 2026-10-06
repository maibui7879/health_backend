import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  ReportCategory,
  ReportDecision,
  ReportTarget,
} from '../entities/report-case.entity';

export class SubmitReportDto {
  @ApiProperty({ enum: ReportTarget, example: ReportTarget.POST })
  @IsEnum(ReportTarget)
  target_type!: ReportTarget;

  @ApiProperty({ description: 'ID của bài/comment/user/workout/template/food.' })
  @IsUUID()
  target_id!: string;

  @ApiProperty({ enum: ReportCategory, example: ReportCategory.INAPPROPRIATE })
  @IsEnum(ReportCategory)
  category!: ReportCategory;

  @ApiPropertyOptional({ example: 'Bài này hướng dẫn sai kỹ thuật...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

export class ReviewReportDto {
  @ApiProperty({ enum: ReportDecision, example: ReportDecision.DISMISS })
  @IsEnum(ReportDecision)
  decision!: ReportDecision;
}
