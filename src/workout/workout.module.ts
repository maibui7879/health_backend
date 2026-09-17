import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { WorkoutController } from './workout.controller';
import { WorkoutService } from './workout.service';
import { Workout } from './entities/workout.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workout, DailyNutrition])],
  controllers: [WorkoutController],
  providers: [WorkoutService],
})
export class WorkoutModule {}
