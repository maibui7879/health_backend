import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { Meal } from './entities/meal.entity';
import { MealItem } from './entities/meal-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Meal, MealItem])],
  controllers: [NutritionController],
  providers: [NutritionService],
})
export class NutritionModule {}
