import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { InsightsModule } from '../insights/insights.module';
import { ExerciseTemplatesService } from './exercise-templates.service';
import { SuggestWorkoutService } from './suggest-workout.service';
import { WorkoutController } from './workout.controller';
import { WorkoutGoalsService } from './workout-goals.service';
import { WorkoutService } from './workout.service';
import { ExerciseTemplate } from './entities/exercise-template.entity';
import { WorkoutGoal } from './entities/workout-goal.entity';
import { Workout } from './entities/workout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workout,
      DailyNutrition,
      ExerciseTemplate,
      WorkoutGoal,
    ]),
    InsightsModule,
  ],
  controllers: [WorkoutController],
  providers: [
    WorkoutService,
    SuggestWorkoutService,
    ExerciseTemplatesService,
    WorkoutGoalsService,
  ],
})
export class WorkoutModule {}
