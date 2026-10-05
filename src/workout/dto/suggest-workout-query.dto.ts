import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SuggestWorkoutQueryDto {
  @ApiPropertyOptional({ example: 3, description: 'Số gợi ý, tối đa 6.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  limit?: number;
}
