import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SuggestPlanRequestDto {
  @ApiPropertyOptional({
    example: 7,
    description: 'Số ngày của kế hoạch (1–7). Mặc định 7 ngày.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  duration_days?: number;
}
