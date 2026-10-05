import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { LocalizationService } from '../i18n/localization.service';
import { InsightsService } from '../insights/insights.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { Workout } from './entities/workout.entity';
import { ExerciseTemplatesService } from './exercise-templates.service';

const UPLOAD_PREFIX = '/uploads/workouts/';

@Injectable()
export class WorkoutService {
  constructor(
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(DailyNutrition)
    private readonly dailyRepo: Repository<DailyNutrition>,
    private readonly i18n: LocalizationService,
    private readonly insights: InsightsService,
    private readonly templates: ExerciseTemplatesService,
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
      media_url: dto.media_url ?? null,
      media_type: dto.media_type ?? null,
      template_id: dto.template_id ?? null,
    });

    if (dto.template_id) {
      const template = await this.templates.mustExist(dto.template_id);
      // Neo activity theo template để suggest/rotation nhất quán.
      workout.activity_type = template.activity_type;
    }

    await this.workoutRepo.save(workout);

    daily.total_burned_kcal += dto.burned_kcal;
    await this.dailyRepo.save(daily);

    // Hook taste 7B (fire-and-forget).
    void this.insights.recordWorkout(userId, dto.activity_type);

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

    await this.removeMediaFile(workout.media_url);
    await this.workoutRepo.remove(workout);

    return { message: this.i18n.t('workout.deleted') };
  }

  // Gắn file upload vào log (Phase 5A). Chỉ chủ log, file cũ bị xóa.
  async attachMedia(
    userId: string,
    workoutId: string,
    filename: string,
    kind: 'image' | 'video',
  ) {
    const workout = await this.mustOwn(userId, workoutId);
    await this.removeMediaFile(workout.media_url);
    workout.media_url = `${UPLOAD_PREFIX}${filename}`;
    workout.media_type = kind;
    workout.media_viewed_at = null;
    return this.workoutRepo.save(workout);
  }

  // Gắn link ngoài (YouTube). Chỉ chủ log.
  async attachMediaLink(userId: string, workoutId: string, url: string) {
    const workout = await this.mustOwn(userId, workoutId);
    await this.removeMediaFile(workout.media_url);
    workout.media_url = url;
    workout.media_type = 'youtube';
    workout.media_viewed_at = null;
    return this.workoutRepo.save(workout);
  }

  // FE báo user đã xem hết media — idempotent (đầu vào streak 5C).
  async markViewed(userId: string, workoutId: string) {
    const workout = await this.mustOwn(userId, workoutId);
    if (!workout.media_url) {
      throw new NotFoundException(this.i18n.t('workout.mediaNotFound'));
    }
    if (!workout.media_viewed_at) {
      workout.media_viewed_at = new Date();
      await this.workoutRepo.save(workout);
    }
    return workout;
  }

  private async mustOwn(userId: string, workoutId: string) {
    const workout = await this.workoutRepo.findOne({
      where: { id: workoutId, user_id: userId },
    });
    if (!workout) {
      throw new NotFoundException(this.i18n.t('workout.notFound'));
    }
    return workout;
  }

  private async removeMediaFile(mediaUrl: string | null) {
    if (!mediaUrl || !mediaUrl.startsWith(UPLOAD_PREFIX)) return;
    const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
    await unlink(join(uploadDir, mediaUrl.replace('/uploads/', ''))).catch(
      () => undefined,
    );
  }
}
