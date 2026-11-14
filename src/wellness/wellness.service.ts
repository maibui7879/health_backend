import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { dateRange, localDate } from '../common/local-date';
import { AddWaterDto, HistoryRangeDto } from './wellness.dto';
import { currentStreak, longestStreak } from '../workout/streak';
import { healthMetrics } from '../users/health-metrics';
import { fallbackMenu, MENU_LEVELS } from '../nutrition/menu-fallback';

export const LEGAL_VERSION = '2026-11-14';
export const MEDICAL_DISCLAIMER =
  'Thông tin, tính toán BMI/TDEE, thực đơn và bài tập chỉ mang tính chất tham khảo cho lối sống lành mạnh, không thay thế chẩn đoán hoặc điều trị chuyên khoa.';
export const BEVERAGE_FACTORS: Record<string, number> = {
  WATER: 1,
  SOUP: 0.95,
  MILK: 0.9,
  TEA: 0.9,
  COFFEE: 0.8,
  ALCOHOL: 0,
};

export interface DailyStats {
  date: string;
  kcal_in: number;
  kcal_out: number;
  water_ml: number;
  water_target_ml: number | null;
  weight_kg: number | null;
  bmi: number | null;
  tdee: number | null;
  kcal_target: number | null;
  has_log: boolean;
}
export interface WaterEntry {
  id: string;
  user_id: string;
  log_date: string | Date;
  beverage_type: string;
  volume_ml: number;
  hydration_factor: number;
  effective_ml: number;
  created_at: Date;
}
export interface Consent {
  version: string;
  accepted_at: Date;
}

@Injectable()
export class WellnessService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly profiles: UsersService,
  ) {}

  async menuTemplates(userId: string) {
    const user = await this.profiles.getMe(userId);
    const args = {
      dietType: user.profile?.diet_type,
      userAllergies: user.allergies?.map((a) => a.allergen_name),
    };
    return MENU_LEVELS.map((kcalTarget) =>
      fallbackMenu({ ...args, kcalTarget }),
    );
  }

  async onboarding(userId: string) {
    const user = await this.profiles.getMe(userId);
    const p = user.profile;
    const modules = p?.enabled_modules ?? ['nutrition', 'water', 'workout'];
    const fields: Record<string, string[]> = {
      nutrition: [
        'date_of_birth',
        'gender',
        'height_cm',
        'current_weight_kg',
        'activity_level',
        'goal_type',
      ],
      water: ['current_weight_kg'],
      workout: ['activity_level', 'goal_type'],
      community: [],
    };
    const missing = Object.fromEntries(
      modules.map((name) => [
        name,
        (fields[name] ?? []).filter((field) => !p?.[field as keyof typeof p]),
      ]),
    );
    return {
      enabled_modules: modules,
      missing_fields: missing,
      metrics: healthMetrics(p ?? {}),
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }

  async history(userId: string, query: HistoryRangeDto) {
    const dates = dateRange(query.from, query.to);
    return this.users.query<Record<string, unknown>[]>(
      `SELECT id, recorded_at, measured_date::text, weight_kg, height_cm,
      bmi, bmr, tdee, kcal_target, water_target FROM health_measurements
      WHERE user_id = $1 AND measured_date BETWEEN $2::date AND $3::date
      ORDER BY measured_date, recorded_at`,
      [userId, dates[0], dates.at(-1)],
    );
  }

  async statistics(userId: string, query: HistoryRangeDto) {
    const dates = dateRange(query.from, query.to);
    // Each day's targets come from a snapshot on or before that day.
    const rows = await this.users.query<DailyStats[]>(
      `SELECT d::date::text AS date,
      COALESCE(n.total_kcal, 0) AS kcal_in, COALESCE(n.total_burned_kcal, 0) AS kcal_out,
      COALESCE(l.water_consumed_ml, 0) AS water_ml,
      COALESCE(l.water_target_ml, target.water_target) AS water_target_ml,
      h.weight_kg, h.bmi, target.tdee, target.kcal_target,
      (n.id IS NOT NULL OR l.id IS NOT NULL) AS has_log
      FROM generate_series($2::date, $3::date, interval '1 day') d
      LEFT JOIN daily_nutritions n ON n.user_id = $1 AND n.date = d::date
      LEFT JOIN daily_logs l ON l.user_id = $1 AND l.log_date = d::date
      LEFT JOIN LATERAL (SELECT * FROM health_measurements m
        WHERE m.user_id = $1 AND m.measured_date <= d::date
        ORDER BY m.measured_date DESC, m.recorded_at DESC LIMIT 1) h ON true
      LEFT JOIN LATERAL (SELECT * FROM health_measurements m
        WHERE m.user_id = $1 AND m.measured_date <= d::date AND m.source = 'PROFILE'
        ORDER BY m.measured_date DESC, m.recorded_at DESC LIMIT 1) target ON true
      ORDER BY d`,
      [userId, dates[0], dates.at(-1)],
    );
    return {
      from: dates[0],
      to: dates.at(-1),
      days: rows,
      has_data: rows.some((r: { has_log: boolean }) => r.has_log),
      water_streak: await this.waterStreak(userId),
    };
  }

  async waterStreak(userId: string) {
    const rows = await this.users.query<{ date: string; done: boolean }[]>(
      `
      SELECT log_date::text AS date,
        (water_target_ml > 0 AND water_consumed_ml >= water_target_ml) AS done
      FROM daily_logs WHERE user_id = $1 AND log_date <= $2::date ORDER BY log_date`,
      [userId, localDate()],
    );
    const days = rows.map((r) => ({
      date: r.date,
      hasWorkout: r.done === true,
      hasMedia: false,
      hasViewedMedia: false,
    }));
    return {
      current_days: currentStreak(days, localDate()),
      longest_days: longestStreak(days),
      today_done: rows.some((r) => r.date === localDate() && r.done),
    };
  }

  async addWater(userId: string, dto: AddWaterDto) {
    const date = dto.date ?? localDate();
    dateRange(date, date);
    if (date > localDate())
      throw new BadRequestException('Không ghi nước cho ngày tương lai.');
    const beverage = dto.beverage_type ?? 'WATER';
    const factor = BEVERAGE_FACTORS[beverage];
    return this.users.manager.transaction(async (manager) => {
      // Lock the user's row so add/delete operations and their totals are serialized.
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      const entries = await manager.query<WaterEntry[]>(
        `INSERT INTO water_entries
        (user_id, log_date, beverage_type, volume_ml, hydration_factor, effective_ml)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          userId,
          date,
          beverage,
          dto.volume_ml,
          factor,
          Math.round(dto.volume_ml * factor),
        ],
      );
      await manager.query(
        `INSERT INTO daily_logs(user_id, log_date, water_consumed_ml)
        VALUES ($1, $2, $3) ON CONFLICT(user_id, log_date) DO UPDATE SET
        water_consumed_ml = daily_logs.water_consumed_ml + EXCLUDED.water_consumed_ml,
        updated_at = now()`,
        [userId, date, Math.round(dto.volume_ml * factor)],
      );
      return { entry: entries[0], coefficient_is_estimate: true };
    });
  }

  async waterEntries(userId: string, date = localDate()) {
    dateRange(date, date);
    return this.users.query<WaterEntry[]>(
      `SELECT * FROM water_entries WHERE user_id = $1 AND log_date = $2
      ORDER BY created_at`,
      [userId, date],
    );
  }

  async deleteWater(userId: string, id: string) {
    return this.users.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      const entries = await manager.query<WaterEntry[]>(
        `DELETE FROM water_entries WHERE user_id = $1 AND id = $2 RETURNING *`,
        [userId, id],
      );
      if (!entries.length)
        throw new NotFoundException('Không tìm thấy bản ghi nước.');
      const entry = entries[0];
      await manager.query(
        `UPDATE daily_logs SET water_consumed_ml = GREATEST(0, water_consumed_ml - $3),
        updated_at = now() WHERE user_id = $1 AND log_date = $2`,
        [userId, entry.log_date, entry.effective_ml],
      );
      return { deleted: true };
    });
  }

  async consent(userId: string) {
    const rows = await this.users.query<Consent[]>(
      'SELECT version, accepted_at FROM legal_consents WHERE user_id = $1 ORDER BY accepted_at DESC',
      [userId],
    );
    return {
      current_version: LEGAL_VERSION,
      accepted: rows.some(
        (r: { version: string }) => r.version === LEGAL_VERSION,
      ),
      history: rows,
    };
  }

  async acceptConsent(userId: string, version: string) {
    await this.users.query(
      `INSERT INTO legal_consents(user_id, version) VALUES ($1, $2)
      ON CONFLICT(user_id, version) DO NOTHING`,
      [userId, version],
    );
    return this.consent(userId);
  }

  async home(userId: string, date = localDate()) {
    dateRange(date, date);
    const [user, settings, stats, meals, workouts, reminders] =
      await Promise.all([
        this.profiles.getMe(userId),
        this.profiles.getSettings(userId),
        this.statistics(userId, { from: date, to: date }),
        this.users.query<Record<string, unknown>[]>(
          `SELECT m.* FROM meals m JOIN daily_nutritions n ON n.id = m.daily_nutrition_id
        WHERE n.user_id = $1 AND n.date = $2 ORDER BY m.logged_at`,
          [userId, date],
        ),
        this.users.query<Record<string, unknown>[]>(
          'SELECT * FROM workouts WHERE user_id = $1 AND date = $2',
          [userId, date],
        ),
        this.users.query<Record<string, unknown>[]>(
          'SELECT * FROM user_reminders WHERE user_id = $1 AND enabled = true ORDER BY time',
          [userId],
        ),
      ]);
    const enabled = user.profile?.enabled_modules ?? [
      'water',
      'nutrition',
      'workout',
    ];
    return {
      date,
      progress: stats.days[0],
      meals,
      workouts,
      reminders,
      widgets: {
        water: enabled.includes('water') && settings.show_water !== false,
        calories:
          enabled.includes('nutrition') && settings.show_calories !== false,
        workout: enabled.includes('workout') && settings.show_workout !== false,
      },
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }
}
