import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';
import { Meal } from './entities/meal.entity';
import { MealItem } from './entities/meal-item.entity';
import { NutritionPlan } from './entities/nutrition-plan.entity';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { Workout } from '../workout/entities/workout.entity';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { NutritionPlansController } from './plans.controller';
import { NutritionPlansService } from './plans.service';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyNutrition,
      Meal,
      MealItem,
      NutritionPlan,
      Workout,
      DailyLog,
      Food,
      FavoriteFood,
    ]),
    UsersModule,
  ],
  controllers: [
    NutritionController,
    NutritionPlansController,
    FoodsController,
    FavoritesController,
  ],
  providers: [
    NutritionService,
    NutritionPlansService,
    FoodsService,
    FavoritesService,
  ],
  exports: [NutritionService, NutritionPlansService],
})
export class NutritionModule {}
