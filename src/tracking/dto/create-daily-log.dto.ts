import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateDailyLogDto {
  @ApiProperty({ example: '2026-09-13', description: 'Ngày ghi nhận dữ liệu' })
  @IsDateString()
  log_date: string;

  @ApiProperty({ example: 2200, description: 'Lượng nước đã uống trong ngày (ml)' })
  @IsNumber()
  @Min(0)
  water_consumed_ml: number;

  @ApiProperty({ example: 1850, description: 'Tổng calo nạp vào trong ngày' })
  @IsNumber()
  @Min(0)
  total_kcal_in: number;

  @ApiProperty({ example: 420, description: 'Tổng calo đã tiêu hao trong ngày' })
  @IsNumber()
  @Min(0)
  total_kcal_out: number;

  @ApiPropertyOptional({ example: 68.5, description: 'Cân nặng hiện tại (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight_log?: number;

}
