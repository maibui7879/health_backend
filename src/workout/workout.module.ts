import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { InsightsModule } from '../insights/insights.module';
import { SuggestWorkoutService } from './suggest-workout.service';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';
import { Workout } from './entities/workout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workout, DailyNutrition]),
    InsightsModule,
  ],
  controllers: [WorkoutController],
  providers: [WorkoutService, SuggestWorkoutService],
})
export class WorkoutModule {}
