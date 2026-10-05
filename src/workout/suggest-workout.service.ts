import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsightsService } from '../insights/insights.service';
import { SuggestWorkoutQueryDto } from './dto/suggest-workout-query.dto';
import { ActivityType, Workout } from './entities/workout.entity';

// Gợi ý buổi tập bằng rule thuần (Phase 7D) — 0 token, 0 gọi AI.
// score = rotation_fit (nhóm cơ tươi) + taste (gu ngầm) [+ nghỉ khi streak]
// Ràng buộc cứng: không tập trùng nhóm cơ 2 ngày liên tiếp (trừ khi không
// còn lựa chọn); nghỉ ngơi sau 5 ngày tập liên tiếp.

const MUSCLES: Record<ActivityType, string[]> = {
  [ActivityType.RUNNING]: ['legs', 'cardio'],
  [ActivityType.CYCLING]: ['legs', 'cardio'],
  [ActivityType.WEIGHT_LIFTING]: ['upper', 'core'],
  [ActivityType.YOGA]: ['flexibility', 'core'],
  [ActivityType.SWIMMING]: ['upper', 'cardio', 'full'],
  [ActivityType.CARDIO]: ['cardio', 'legs'],
};

const HISTORY_DAYS = 14;
const REST_AFTER_STREAK = 5;
const PROGRESSION_RATE = 0.05;
const DEFAULT_DURATION = 30;
const MIN_DURATION = 10;
const MAX_DURATION = 120;

export type WorkoutSuggestReason = { code: string; tags?: string[] };

export type WorkoutSuggestion = {
  activity_type: ActivityType | 'REST';
  rest: boolean;
  duration_minutes: number;
  muscle_groups: string[];
  score: { rotation: number; taste: number; total: number };
  reasons: WorkoutSuggestReason[];
};

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function round5(n: number): number {
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(n / 5) * 5));
}

@Injectable()
export class SuggestWorkoutService {
  constructor(
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    private readonly insights: InsightsService,
  ) {}

  async suggest(userId: string, dto: SuggestWorkoutQueryDto) {
    const limit = Math.min(Math.max(dto.limit ?? 3, 1), 6);
    const taste = await this.insights.getProfile(userId).catch(() => null);
    const prefs = taste?.workout_prefs ?? {};
    const tasteWeight = taste?.weight ?? 0;
    const maxPref = Math.max(0, ...Object.values(prefs));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = new Date(today.getTime() - (HISTORY_DAYS - 1) * 86400000);

    const history = await this.workoutRepo.find({
      where: { user_id: userId },
      order: { date: 'DESC' },
    });
    const recent = history.filter((w) => w.date >= toISODate(since));

    const trained = new Set(recent.map((w) => w.date));
    const yesterday = new Date(today.getTime() - 86400000);
    const yesterdayStr = toISODate(yesterday);

    // Streak ngày tập liên tiếp (tính từ hôm nay ngược về trước).
    let streak = 0;
    for (let back = 0; ; back++) {
      const day = toISODate(new Date(today.getTime() - back * 86400000));
      if (!trained.has(day)) break;
      streak += 1;
    }

    const yesterdayGroups = new Set(
      recent
        .filter((w) => w.date === yesterdayStr)
        .flatMap((w) => MUSCLES[w.activity_type] ?? []),
    );
    const lastDuration = new Map<ActivityType, number>();
    for (const w of recent) {
      if (!lastDuration.has(w.activity_type)) {
        lastDuration.set(w.activity_type, w.duration_minutes);
      }
    }

    const suggestions: WorkoutSuggestion[] = (
      Object.keys(MUSCLES) as ActivityType[]
    ).map((activity) => {
      const groups = MUSCLES[activity] ?? [];
      const fresh = groups.filter((g) => !yesterdayGroups.has(g));
      const rotation = Math.min(fresh.length, 2);
      const tasteScore =
        maxPref > 0 ? ((prefs[activity] ?? 0) / maxPref) * tasteWeight : 0;
      const prev = lastDuration.get(activity);
      const duration =
        prev !== undefined
          ? round5(prev * (1 + PROGRESSION_RATE))
          : DEFAULT_DURATION;

      const reasons: WorkoutSuggestReason[] = [];
      if (fresh.length > 0)
        reasons.push({ code: 'rotation_recovery', tags: fresh });
      if ((prefs[activity] ?? 0) > 0)
        reasons.push({ code: 'taste_match', tags: [activity] });
      if (prev !== undefined)
        reasons.push({ code: 'progression', tags: [`${prev}→${duration}`] });
      if (prev === undefined) reasons.push({ code: 'variety_new' });

      return {
        activity_type: activity,
        rest: false,
        duration_minutes: duration,
        muscle_groups: groups,
        score: {
          rotation: rotation,
          taste: Math.round(tasteScore * 100) / 100,
          total: Math.round((rotation + tasteScore) * 100) / 100,
        },
        reasons: reasons.slice(0, 3),
      };
    });
    suggestions.sort((a, b) => b.score.total - a.score.total);

    // Nghỉ sau chuỗi ngày tập liên tiếp — đặt lên đầu, vẫn kèm lựa chọn nhẹ.
    if (streak >= REST_AFTER_STREAK) {
      suggestions.unshift({
        activity_type: 'REST',
        rest: true,
        duration_minutes: 0,
        muscle_groups: [],
        score: { rotation: 0, taste: 0, total: 99 },
        reasons: [{ code: 'recovery_streak', tags: [`${streak}`] }],
      });
    }

    return {
      suggestions: suggestions.slice(0, limit),
      meta: {
        streak_days: streak,
        trained_yesterday_groups: [...yesterdayGroups],
        taste_weight: tasteWeight,
      },
    };
  }
}
