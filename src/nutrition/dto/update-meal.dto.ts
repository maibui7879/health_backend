import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMealDto } from './create-meal.dto';

export class UpdateMealDto extends PartialType(
  OmitType(CreateMealDto, ['date'] as const),
) {}
