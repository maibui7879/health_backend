import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReviewDayDto {
  @ApiProperty({
    example: '2026-10-06',
    description: 'Ngày cần AI nhận xét (YYYY-MM-DD).',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Bỏ trống để dùng plan ACTIVE mới nhất.',
  })
  @IsOptional()
  @IsUUID()
  plan_id?: string;
}
