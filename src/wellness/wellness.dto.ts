import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class HistoryRangeDto {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class AddWaterDto {
  @ApiProperty({ example: 250 })
  @IsInt()
  @Min(1)
  @Max(10000)
  volume_ml!: number;

  @ApiPropertyOptional({
    enum: ['WATER', 'SOUP', 'MILK', 'TEA', 'COFFEE', 'ALCOHOL'],
  })
  @IsOptional()
  @IsIn(['WATER', 'SOUP', 'MILK', 'TEA', 'COFFEE', 'ALCOHOL'])
  beverage_type?: string;

  @ApiPropertyOptional({ example: '2026-11-14' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class AcceptConsentDto {
  @ApiProperty({ example: '2026-11-14' })
  @IsString()
  @IsIn(['2026-11-14'])
  version!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsIn([true])
  accepted!: boolean;
}
