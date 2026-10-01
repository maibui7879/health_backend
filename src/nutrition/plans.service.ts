import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { UsersService } from '../users/users.service';
import { Workout } from '../workout/entities/workout.entity';
import {
  CloneTemplateDto,
  CreatePlanDto,
  PlanQueryDto,
  PublishTemplateDto,
  TemplateQueryDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { Meal } from './entities/meal.entity';
import { NutritionPlan, PlanStatus } from './entities/nutrition-plan.entity';

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export type AdherenceVerdict =
  'ON_TRACK' | 'SLIGHTLY_OFF' | 'OFF_TRACK' | 'NO_DATA';

export interface PlanDayEntry {
  day?: number;
  meals?: {
    meal_type?: string;
    suggestion?: string;
    kcal?: number;
  }[];
  workout?: {
    activity?: string;
    duration_minutes?: number;
    note?: string;
  };
  tip?: string;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function kcalScore(planned: number, actual: number): number | null {
  if (planned <= 0) return actual <= 0 ? 100 : null;
  const diff = Math.abs(actual - planned) / planned;
  if (diff <= 0.1) return 100;
  if (diff <= 0.25) return 70;
  if (diff <= 0.5) return 40;
  return 10;
}

function ratioScore(planned: number, actual: number): number | null {
  if (planned <= 0) return null;
  return Math.min(100, Math.round((actual / planned) * 100));
}

@Injectable()
export class NutritionPlansService {
  constructor(
    @InjectRepository(NutritionPlan)
    private readonly planRepo: Repository<NutritionPlan>,
    @InjectRepository(Meal)
    private readonly mealRepo: Repository<Meal>,
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(DailyLog)
    private readonly logRepo: Repository<DailyLog>,
    @InjectRepository(DailyNutrition)
    private readonly dailyRepo: Repository<DailyNutrition>,
    private readonly usersService: UsersService,
    private readonly i18n: LocalizationService,
  ) {}

  // User bấm "Theo plan này" → plan mới ACTIVE, plan ACTIVE cũ ARCHIVE (ABANDONED).
  // Template (is_template) không tính vào luật 1 ACTIVE.
  async create(userId: string, dto: CreatePlanDto) {
    const from = new Date(`${dto.date_from}T00:00:00Z`);
    const to = dto.date_to
      ? new Date(`${dto.date_to}T00:00:00Z`)
      : new Date(from.getTime() + 6 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException(this.i18n.t('nutrition.planBadRange'));
    }
    if (to < from) {
      throw new BadRequestException(this.i18n.t('nutrition.planBadRange'));
    }

    await this.planRepo.update(
      { user_id: userId, status: PlanStatus.ACTIVE, is_template: false },
      { status: PlanStatus.ABANDONED },
    );

    const plan = this.planRepo.create({
      user_id: userId,
      title: dto.title ?? null,
      date_from: toISODate(from),
      date_to: toISODate(to),
      goal_summary: dto.goal_summary ?? null,
      goal_snapshot: dto.goal_snapshot ?? null,
      items: dto.items,
      status: PlanStatus.ACTIVE,
      is_template: false,
    });
    const saved = await this.planRepo.save(plan);
    return { message: this.i18n.t('nutrition.planSaved'), plan: saved };
  }

  async list(userId: string, query: PlanQueryDto) {
    return this.planRepo.find({
      where: {
        user_id: userId,
        status: query.status ?? PlanStatus.ACTIVE,
        is_template: query.is_template ?? false,
      },
      order: { date_from: 'DESC', created_at: 'DESC' },
    });
  }

  async getOne(userId: string, id: string) {
    return this.getOwned(userId, id);
  }

  async update(userId: string, id: string, dto: UpdatePlanDto) {
    const plan = await this.getOwned(userId, id);
    // Kích hoạt lại → các ACTIVE khác phải nhường (giữ 1 active/user).
    if (dto.status === PlanStatus.ACTIVE && plan.status !== PlanStatus.ACTIVE) {
      await this.planRepo.update(
        {
          user_id: userId,
          status: PlanStatus.ACTIVE,
          is_template: false,
        },
        { status: PlanStatus.ABANDONED },
      );
    }
    if (dto.title !== undefined) plan.title = dto.title;
    plan.status = dto.status;
    const saved = await this.planRepo.save(plan);
    return { message: this.i18n.t('nutrition.planUpdated'), plan: saved };
  }

  private async getOwned(userId: string, id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(this.i18n.t('nutrition.planNotFound'));
    }
    if (plan.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('nutrition.planForbidden'));
    }
    return plan;
  }

  private async getTemplate(id: string) {
    const plan = await this.planRepo.findOne({
      where: { id, is_template: true },
    });
    if (!plan) {
      throw new NotFoundException(this.i18n.t('nutrition.templateNotFound'));
    }
    return plan;
  }

  // Đăng plan COMPLETED thành mẫu chia sẻ: copy snapshot tách khỏi lịch
  // của tác giả. Yêu cầu điểm trung bình ≥ 70 ở các ngày đã có dữ liệu.
  async publish(userId: string, id: string, dto: PublishTemplateDto) {
    const plan = await this.getOwned(userId, id);
    if (plan.status !== PlanStatus.COMPLETED) {
      throw new BadRequestException(this.i18n.t('nutrition.planNotCompleted'));
    }

    const from = new Date(`${plan.date_from}T00:00:00Z`);
    const end = new Date(`${plan.date_to}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const lastDay = end < today ? end : today;
    const dayCount = Math.min(
      31,
      Math.max(
        0,
        Math.round((lastDay.getTime() - from.getTime()) / 86400000) + 1,
      ),
    );
    const scores: number[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(from.getTime() + i * 86400000);
      const result = await this.adherence(userId, toISODate(d), plan.id);
      if (typeof result.scores.overall === 'number') {
        scores.push(result.scores.overall);
      }
    }
    if (scores.length === 0) {
      throw new BadRequestException(this.i18n.t('nutrition.planNoData'));
    }
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    if (avg < 70) {
      throw new BadRequestException(this.i18n.t('nutrition.planScoreLow'));
    }

    const template = this.planRepo.create({
      user_id: userId,
      title: dto.title ?? plan.title,
      date_from: plan.date_from,
      date_to: plan.date_to,
      goal_summary: plan.goal_summary,
      goal_snapshot: plan.goal_snapshot,
      items: plan.items,
      status: PlanStatus.COMPLETED,
      is_template: true,
      cover_emoji: dto.cover_emoji ?? null,
      use_count: 0,
    });
    const saved = await this.planRepo.save(template);
    return { message: this.i18n.t('nutrition.planPublished'), plan: saved };
  }

  async listTemplates(query: TemplateQueryDto) {
    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const skip = Math.max(query.offset ?? 0, 0);
    const qb = this.planRepo
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .leftJoin('u.profile', 'pr')
      .where('p.is_template = TRUE')
      .select(['p', 'u.id', 'pr.full_name'])
      .orderBy(query.sort === 'new' ? 'p.created_at' : 'p.use_count', 'DESC')
      .take(take)
      .skip(skip);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((p) => {
        const withUser = p as NutritionPlan & {
          user?: { profile?: { full_name?: string } | null } | null;
        };
        const { user: _owner, ...rest } = withUser;
        void _owner;
        return {
          ...rest,
          author_name: withUser.user?.profile?.full_name ?? null,
        };
      }),
      total,
    };
  }

  // Bê mẫu về: copy snapshot theo ngày bắt đầu mới, goal_snapshot làm mới
  // từ profile người bê. Plan ACTIVE cũ của họ tự archive (luật 1 ACTIVE).
  async clone(userId: string, templateId: string, dto: CloneTemplateDto) {
    const template = await this.getTemplate(templateId);
    const items = Array.isArray(template.items) ? template.items : [];
    const start = new Date(`${dto.start_date}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException(this.i18n.t('nutrition.planBadRange'));
    }
    const end = new Date(
      start.getTime() + Math.max(items.length - 1, 0) * 86400000,
    );

    let goalSnapshot: Record<string, unknown> | null = null;
    try {
      const me = await this.usersService.getMe(userId);
      const profile = (me?.profile ?? {}) as unknown as Record<string, unknown>;
      goalSnapshot = {
        daily_kcal_target: profile.daily_kcal_target ?? null,
        goal_type: profile.goal_type ?? null,
        diet_type: profile.diet_type ?? null,
      };
    } catch {
      goalSnapshot = null;
    }

    const created = await this.create(userId, {
      title: template.title ?? undefined,
      date_from: toISODate(start),
      date_to: toISODate(end),
      goal_summary: template.goal_summary ?? undefined,
      goal_snapshot: goalSnapshot ?? undefined,
      items,
    });

    await this.planRepo
      .createQueryBuilder()
      .update()
      .set({ use_count: () => 'use_count + 1' })
      .where('id = :id', { id: template.id })
      .execute();

    return created;
  }

  private async resolvePlan(userId: string, planId?: string) {
    if (planId) {
      const plan = await this.planRepo.findOne({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException(this.i18n.t('nutrition.planNotFound'));
      }
      // Template public: ai cũng xem/so được; plan thường chỉ chủ sở hữu.
      if (!plan.is_template && plan.user_id !== userId) {
        throw new ForbiddenException(this.i18n.t('nutrition.planForbidden'));
      }
      return plan;
    }
    const active = await this.planRepo.find({
      where: {
        user_id: userId,
        status: PlanStatus.ACTIVE,
        is_template: false,
      },
      order: { created_at: 'DESC' },
      take: 1,
    });
    if (active.length === 0 || !active[0]) {
      throw new NotFoundException(this.i18n.t('nutrition.planNotFound'));
    }
    return active[0];
  }

  private findPlanDay(items: unknown, dayIndex: number): PlanDayEntry | null {
    if (!Array.isArray(items)) return null;
    const entries = items as PlanDayEntry[];
    const byDay = entries.find((e) => num(e?.day) === dayIndex + 1);
    if (byDay) return byDay;
    const positional = entries[dayIndex];
    return positional ?? null;
  }

  // So plan vs thực tế trong 1 ngày: điểm từng phần + tổng + verdict.
  // Trọng số kcal 60 / workout 25 / nước 15; phần nào không có dữ liệu
  // 2 phía thì loại và chia lại trọng số.
  async adherence(userId: string, date: string, planId?: string) {
    const plan = await this.resolvePlan(userId, planId);
    const from = new Date(`${plan.date_from}T00:00:00Z`);
    const target = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(target.getTime())) {
      throw new BadRequestException(this.i18n.t('nutrition.planBadRange'));
    }
    const dayIndex = Math.round((target.getTime() - from.getTime()) / 86400000);
    const planDay = this.findPlanDay(plan.items, dayIndex);
    if (!planDay) {
      throw new NotFoundException(this.i18n.t('nutrition.noPlanCoverage'));
    }

    const meals = await this.mealRepo
      .createQueryBuilder('m')
      .innerJoin('m.daily_nutrition', 'd')
      .leftJoinAndSelect('m.items', 'it')
      .where('d.user_id = :userId', { userId })
      .andWhere('d.date = :date', { date })
      .getMany();
    const workouts = await this.workoutRepo.find({
      where: { user_id: userId, date },
      order: { logged_at: 'ASC' },
    });
    const log = await this.logRepo.findOne({
      where: { user_id: userId, log_date: date },
    });
    const me = await this.usersService.getMe(userId).catch(() => null);
    const profile = (me?.profile ?? {}) as Record<string, unknown>;

    const plannedMeals = Array.isArray(planDay.meals) ? planDay.meals : [];
    const plannedKcal = plannedMeals.reduce((s, m) => s + num(m?.kcal), 0);
    const plannedWorkoutMin = num(planDay.workout?.duration_minutes);

    const actualMeals = meals.map((m) => ({
      meal_type: m.meal_type,
      kcal: num(m.meal_kcal),
      items: (m.items ?? []).map((it) => it.food_name_vi),
    }));
    const actualKcal = actualMeals.reduce((s, m) => s + m.kcal, 0);
    const actualWorkoutMin = workouts.reduce(
      (s, w) => s + num(w.duration_minutes),
      0,
    );
    const waterMl = num(log?.water_consumed_ml);
    const waterTarget = num(profile.daily_water_target) || 2000;

    const kcal = kcalScore(plannedKcal, actualKcal);
    const workout = ratioScore(plannedWorkoutMin, actualWorkoutMin);
    const water = ratioScore(waterTarget, waterMl);

    const parts: { score: number; weight: number }[] = [];
    if (kcal !== null) parts.push({ score: kcal, weight: 0.6 });
    if (workout !== null) parts.push({ score: workout, weight: 0.25 });
    if (water !== null) parts.push({ score: water, weight: 0.15 });
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const overall =
      totalWeight > 0
        ? Math.round(
            parts.reduce((s, p) => s + (p.score * p.weight) / totalWeight, 0),
          )
        : null;
    const verdict: AdherenceVerdict =
      overall === null
        ? 'NO_DATA'
        : overall >= 80
          ? 'ON_TRACK'
          : overall >= 50
            ? 'SLIGHTLY_OFF'
            : 'OFF_TRACK';

    return {
      date,
      plan_id: plan.id,
      plan_day: planDay,
      planned: {
        kcal: plannedKcal,
        meals: plannedMeals.map((m) => ({
          meal_type: m.meal_type ?? null,
          suggestion: m.suggestion ?? null,
          kcal: num(m.kcal),
        })),
        workout: planDay.workout
          ? {
              activity: planDay.workout.activity ?? null,
              duration_minutes: plannedWorkoutMin,
            }
          : null,
      },
      actual: {
        kcal: actualKcal,
        kcal_diff: actualKcal - plannedKcal,
        meals: actualMeals,
        workouts: workouts.map((w) => ({
          activity_type: w.activity_type,
          duration_minutes: num(w.duration_minutes),
          burned_kcal: num(w.burned_kcal),
        })),
        workout_minutes: actualWorkoutMin,
        water_ml: waterMl,
        water_target_ml: waterTarget,
        weight_kg: log?.weight_log ?? null,
      },
      scores: { kcal, workout, water, overall },
      verdict,
    };
  }
}
