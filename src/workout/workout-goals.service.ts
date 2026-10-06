import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CreateWorkoutGoalDto } from './dto/create-workout-goal.dto';
import { Workout } from './entities/workout.entity';
import { WorkoutGoal, WorkoutGoalStatus } from './entities/workout-goal.entity';
import {
  currentStreak,
  DayActivity,
  dayCounts,
  longestStreak,
  toISODate,
} from './streak';

function utcToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return toISODate(d);
}

@Injectable()
export class WorkoutGoalsService {
  constructor(
    @InjectRepository(WorkoutGoal)
    private readonly goalRepo: Repository<WorkoutGoal>,
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    private readonly i18n: LocalizationService,
    private readonly notifications: NotificationsService,
  ) {}

  // Streak tập riêng (không dùng daily_logs.is_streak_day).
  async getStreak(userId: string) {
    const days = await this.loadDays(userId);
    const today = utcToday();
    const counted = days.filter((d) => d.hasWorkout && d.date <= today);
    const todayEntry = counted.find((d) => d.date === today);
    return {
      current_days: currentStreak(counted, today),
      longest_days: longestStreak(counted),
      last_active_date:
        [...counted]
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .find((d) => d.hasWorkout)?.date ?? null,
      today_done: todayEntry ? dayCounts(todayEntry) : false,
    };
  }

  async createGoal(userId: string, dto: CreateWorkoutGoalDto) {
    const active = await this.goalRepo.findOne({
      where: { user_id: userId, status: WorkoutGoalStatus.ACTIVE },
    });
    if (active) {
      throw new ConflictException(this.i18n.t('workout.goalExists'));
    }
    const start = utcToday();
    const end = toISODate(
      new Date(
        new Date(`${start}T00:00:00.000Z`).getTime() +
          (dto.target_days - 1) * 86400000,
      ),
    );
    const goal = this.goalRepo.create({
      user_id: userId,
      target_days: dto.target_days,
      start_date: start,
      end_date: end,
      status: WorkoutGoalStatus.ACTIVE,
      badge: null,
    });
    return this.goalRepo.save(goal);
  }

  async currentGoal(userId: string) {
    const goal = await this.goalRepo.findOne({
      where: { user_id: userId, status: WorkoutGoalStatus.ACTIVE },
      order: { created_at: 'DESC' },
    });
    if (!goal) {
      throw new NotFoundException(this.i18n.t('workout.goalNotFound'));
    }
    return goal;
  }

  listGoals(userId: string) {
    return this.goalRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  // Cron 1AM: chốt ACTIVE -> COMPLETED (đủ ngày liên tiếp tới end_date,
  // badge 'STREAK_<N>') hoặc FAILED (đứt mạch ngày đã qua).
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async settleGoals() {
    const actives = await this.goalRepo.find({
      where: { status: WorkoutGoalStatus.ACTIVE },
    });
    for (const goal of actives) {
      await this.settleOne(goal);
    }
    return { settled: actives.length };
  }

  async settleOne(goal: WorkoutGoal) {
    const days = await this.loadDays(goal.user_id);
    const byDate = new Map(days.map((d) => [d.date, d]));
    const start = new Date(`${goal.start_date}T00:00:00.000Z`).getTime();
    const end = new Date(`${goal.end_date}T00:00:00.000Z`).getTime();
    const today = utcToday();
    let okDays = 0;
    let failed = false;
    for (let t = start; t <= end; t += 86400000) {
      const date = toISODate(new Date(t));
      if (date >= today) break; // ngày hiện tại/tương lai chưa chốt
      const d = byDate.get(date);
      if (d && dayCounts(d)) {
        okDays += 1;
      } else {
        failed = true;
        break;
      }
    }
    if (failed) {
      goal.status = WorkoutGoalStatus.FAILED;
      goal.completed_at = new Date();
      return this.goalRepo.save(goal);
    }
    if (okDays >= goal.target_days) {
      goal.status = WorkoutGoalStatus.COMPLETED;
      goal.badge = `STREAK_${goal.target_days}`;
      goal.completed_at = new Date();
      const done = await this.goalRepo.save(goal);
      void this.notifications
        .notify(goal.user_id, {
          type: NotificationType.GOAL_COMPLETED,
          title: { vi: 'Chúc mừng! Hoàn thành mục tiêu', en: 'Congrats! Goal completed' },
          body: {
            vi: `Bạn đã tập liên tiếp ${goal.target_days} ngày. Huy hiệu ${goal.badge}.`,
            en: `${goal.target_days}-day streak done. Badge ${goal.badge}.`,
          },
          data: { route: '/workout' },
        })
        .catch(() => undefined);
      return done;
    }
    return goal; // chưa tới hạn, giữ ACTIVE
  }

  private async loadDays(userId: string): Promise<DayActivity[]> {
    const logs = await this.workoutRepo.find({ where: { user_id: userId } });
    const byDate = new Map<string, DayActivity>();
    for (const w of logs) {
      const cur = byDate.get(w.date) ?? {
        date: w.date,
        hasWorkout: false,
        hasMedia: false,
        hasViewedMedia: false,
      };
      cur.hasWorkout = true;
      if (w.media_url) {
        cur.hasMedia = true;
        if (w.media_viewed_at) cur.hasViewedMedia = true;
      }
      byDate.set(w.date, cur);
    }
    return [...byDate.values()];
  }
}
