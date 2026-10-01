import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReminderType } from '../entities/reminder.entity';

export class CreateReminderDto {
  @ApiProperty({ enum: ReminderType, example: ReminderType.WATER })
  @IsEnum(ReminderType)
  type!: ReminderType;

  @ApiProperty({ example: '08:00', description: 'Giờ (UTC) định dạng HH:mm' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    description: 'Ngày trong tuần 0 (CN)–6 (T7). Bỏ trống = hàng ngày.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days?: number[];

  @ApiPropertyOptional({ example: 'Uống nước' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'Đã 2 tiếng rồi, uống 250ml nhé' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  body?: string;
}

export class UpdateReminderDto {
  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string;

  @ApiPropertyOptional({ example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  days?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  body?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
