import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CreateWorkoutGoalDto {
  @ApiProperty({
    example: 7,
    description: 'Mục tiêu số ngày tập liên tiếp (7 | 14 | 30)',
  })
  @IsIn([7, 14, 30])
  target_days!: number;
}
