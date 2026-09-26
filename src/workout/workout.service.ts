import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { LocalizationService } from '../i18n/localization.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { Workout } from './entities/workout.entity';

@Injectable()
export class WorkoutService {
  constructor(
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(DailyNutrition)
    private readonly dailyRepo: Repository<DailyNutrition>,
    private readonly i18n: LocalizationService,
  ) {}

  async createWorkout(userId: string, dto: CreateWorkoutDto) {
    let daily = await this.dailyRepo.findOne({
      where: { user_id: userId, date: dto.date },
    });

    if (!daily) {
      daily = this.dailyRepo.create({
        user_id: userId,
        date: dto.date,
        total_kcal: 0,
        total_burned_kcal: 0,
      });
      await this.dailyRepo.save(daily);
    }

    const workout = this.workoutRepo.create({
      user_id: userId,
      activity_type: dto.activity_type,
      duration_minutes: dto.duration_minutes,
      burned_kcal: dto.burned_kcal,
      date: dto.date,
    });

    await this.workoutRepo.save(workout);

    daily.total_burned_kcal += dto.burned_kcal;
    await this.dailyRepo.save(daily);

    return workout;
  }

  async getWorkoutsByDate(userId: string, date: string) {
    return this.workoutRepo.find({
      where: { user_id: userId, date },
      order: { logged_at: 'DESC' },
    });
  }

  async deleteWorkout(userId: string, workoutId: string) {
    const workout = await this.workoutRepo.findOne({
      where: { id: workoutId, user_id: userId },
    });

    if (!workout) {
      throw new NotFoundException(this.i18n.t('workout.notFound'));
    }

    const daily = await this.dailyRepo.findOne({
      where: { user_id: userId, date: workout.date },
    });

    if (daily) {
      daily.total_burned_kcal = Math.max(
        0,
        daily.total_burned_kcal - workout.burned_kcal,
      );
      await this.dailyRepo.save(daily);
    }

    await this.workoutRepo.remove(workout);

    return { message: this.i18n.t('workout.deleted') };
  }
}
