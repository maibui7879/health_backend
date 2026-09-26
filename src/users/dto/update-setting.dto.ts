import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional } from 'class-validator';

export class UpdateSettingDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remind_water?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  water_interval_mins?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remind_meals?: boolean;

  @ApiPropertyOptional({
    example: { breakfast: '07:00', lunch: '12:00', dinner: '19:00' },
  })
  @IsOptional()
  meal_times?: Record<string, string>;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Ngôn ngữ hiển thị: vi | en',
  })
  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: string;
}
