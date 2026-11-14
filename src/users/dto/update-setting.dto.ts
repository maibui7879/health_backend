import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class UpdateSettingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_water?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_calories?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  show_workout?: boolean;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  water_start_time?: string;

  @ApiPropertyOptional({ example: '20:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  water_end_time?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remind_water?: boolean;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(15)
  @Max(1440)
  water_interval_mins?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remind_meals?: boolean;

  @ApiPropertyOptional({
    example: { breakfast: '07:00', lunch: '12:00', dinner: '19:00' },
  })
  @IsOptional()
  @IsObject()
  meal_times?: Record<string, string>;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Ngôn ngữ hiển thị: vi | en',
  })
  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: string;
}
