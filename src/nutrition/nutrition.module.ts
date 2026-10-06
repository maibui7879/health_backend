import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';
import { Meal } from './entities/meal.entity';
import { MealItem } from './entities/meal-item.entity';
import { NutritionPlan } from './entities/nutrition-plan.entity';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { Workout } from '../workout/entities/workout.entity';
import { InsightsModule } from '../insights/insights.module';
import { SuggestService } from './suggest.service';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';
import { NutritionPlansController } from './plans.controller';
import { NutritionPlansService } from './plans.service';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { FoodSubmission } from './entities/food-submission.entity';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

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
      FoodSubmission,
    ]),
    UsersModule,
    InsightsModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [
    NutritionController,
    NutritionPlansController,
    FoodsController,
    FavoritesController,
    ModerationController,
  ],
  providers: [
    NutritionService,
    NutritionPlansService,
    FoodsService,
    FavoritesService,
    SuggestService,
    ModerationService,
  ],
  exports: [NutritionService, NutritionPlansService],
})
export class NutritionModule {}
