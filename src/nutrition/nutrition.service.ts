import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { LocalizationService } from '../i18n/localization.service';
import { InsightsService } from '../insights/insights.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { SearchHistoryDto } from './dto/search-history.dto';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { Meal } from './entities/meal.entity';
import { MealItem } from './entities/meal-item.entity';
import { UpdateMealDto } from './dto/update-meal.dto';
import { dateRange, localDate } from '../common/local-date';

@Injectable()
export class NutritionService {
  constructor(
    @InjectRepository(DailyNutrition)
    private dailyRepo: Repository<DailyNutrition>,
    @InjectRepository(Meal)
    private mealRepo: Repository<Meal>,
    private usersService: UsersService,
    private readonly i18n: LocalizationService,
    private readonly insights: InsightsService,
  ) {}

  async createMeal(userId: string, dto: CreateMealDto) {
    let daily = await this.dailyRepo.findOne({
      where: { user_id: userId, date: dto.date },
    });

    if (!daily) {
      daily = this.dailyRepo.create({
        user_id: userId,
        date: dto.date,
        total_kcal: 0,
      });
      await this.dailyRepo.save(daily);
    }

    let mealKcal = 0;
    let isMealSafe = true;

    const mealItems = dto.items.map((item) => {
      mealKcal += item.estimated_kcal;

      if (item.is_allergen || (item.warnings && item.warnings.length > 0)) {
        isMealSafe = false;
      }

      const mealItem = new MealItem();
      mealItem.food_name_vi = item.food_name_vi;
      mealItem.food_name_en = item.food_name_en ?? '';
      mealItem.estimated_kcal = item.estimated_kcal;
      mealItem.is_allergen = item.is_allergen;
      mealItem.warnings = item.warnings ?? [];
      return mealItem;
    });

    const meal = this.mealRepo.create({
      daily_nutrition_id: daily.id,
      meal_type: dto.meal_type,
      meal_kcal: mealKcal,
      is_safe: isMealSafe,
      items: mealItems,
    });

    await this.mealRepo.save(meal);

    daily.total_kcal += mealKcal;
    await this.dailyRepo.save(daily);

    // Hook taste 7B (fire-and-forget, không chặn response).
    void this.insights.recordMeal(
      userId,
      dto.items.flatMap((i) => [i.food_name_vi, i.food_name_en ?? '']),
    );

    return meal;
  }

  async updateMeal(userId: string, mealId: string, dto: UpdateMealDto) {
    return this.dailyRepo.manager.transaction(async (manager) => {
      const rows = await manager.query<Meal[]>(
        `SELECT m.*, n.user_id FROM meals m
        JOIN daily_nutritions n ON n.id = m.daily_nutrition_id
        WHERE m.id = $1 AND n.user_id = $2 FOR UPDATE OF n, m`,
        [mealId, userId],
      );
      if (!rows.length)
        throw new NotFoundException(this.i18n.t('nutrition.mealNotFound'));
      const meal = rows[0];
      const kcal =
        dto.items?.reduce((sum, item) => sum + item.estimated_kcal, 0) ??
        meal.meal_kcal;
      const safe = dto.items
        ? dto.items.every((item) => !item.is_allergen && !item.warnings?.length)
        : meal.is_safe;
      await manager.query(
        'UPDATE meals SET meal_type = $2, meal_kcal = $3, is_safe = $4 WHERE id = $1',
        [mealId, dto.meal_type ?? meal.meal_type, kcal, safe],
      );
      if (dto.items) {
        await manager.query('DELETE FROM meal_items WHERE meal_id = $1', [
          mealId,
        ]);
        for (const item of dto.items) {
          await manager.query(
            `INSERT INTO meal_items(meal_id, food_name_vi, food_name_en, estimated_kcal, is_allergen, warnings)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [
              mealId,
              item.food_name_vi,
              item.food_name_en ?? '',
              item.estimated_kcal,
              item.is_allergen,
              JSON.stringify(item.warnings ?? []),
            ],
          );
        }
      }
      await manager.query(
        `UPDATE daily_nutritions SET total_kcal = GREATEST(0, total_kcal + $2), updated_at = now()
        WHERE id = $1`,
        [meal.daily_nutrition_id, kcal - meal.meal_kcal],
      );
      return manager
        .getRepository(Meal)
        .findOne({ where: { id: mealId }, relations: { items: true } });
    });
  }

  async getDailyDashboard(userId: string, date: string) {
    const daily = await this.dailyRepo.findOne({
      where: { user_id: userId, date },
      relations: {
        meals: {
          items: true,
        },
      },
    });

    const diary: Record<string, Meal[]> = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
      SNACK: [],
      PRE_WORKOUT: [],
      POST_WORKOUT: [],
    };

    if (!daily) {
      return {
        date,
        total_kcal: 0,
        diary,
        warnings: [],
      };
    }

    daily.meals.forEach((meal) => {
      if (diary[meal.meal_type] !== undefined) {
        diary[meal.meal_type].push(meal);
      }
    });

    Object.keys(diary).forEach((key) => {
      diary[key].sort(
        (a, b) =>
          new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
      );
    });

    return {
      ...daily,
      diary,
      warnings: await this.dailyWarnings(userId, daily.total_kcal, daily.meals),
    };
  }

  // Mã cảnh báo cho FE tự dịch hiển thị: vượt/ngưỡng ngân sách, bữa không an toàn.
  private async dailyWarnings(
    userId: string,
    totalKcal: number,
    meals: { is_safe?: boolean }[],
  ): Promise<string[]> {
    const warnings: string[] = [];
    if (meals.some((m) => m.is_safe === false)) {
      warnings.push('UNSAFE_MEAL');
    }
    if (totalKcal <= 0) {
      return warnings;
    }
    try {
      const me = await this.usersService.getMe(userId);
      const profile = (me.profile ?? {}) as unknown as Record<string, unknown>;
      const target = Number(profile.daily_kcal_target);
      if (!Number.isFinite(target) || target <= 0) {
        return warnings;
      }
      const ratio = totalKcal / target;
      if (ratio >= 1.2) {
        warnings.push('OVER_BUDGET');
      } else if (ratio <= 0.5) {
        warnings.push('UNDER_BUDGET');
      }
    } catch {
      // Không lấy được target thì chỉ giữ cảnh báo bữa ăn.
    }
    return warnings;
  }

  async deleteMeal(userId: string, mealId: string) {
    const meal = await this.mealRepo.findOne({
      where: { id: mealId },
      relations: { daily_nutrition: true },
    });

    if (!meal) {
      throw new NotFoundException(this.i18n.t('nutrition.mealNotFound'));
    }

    if (meal.daily_nutrition.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('nutrition.mealForbidden'));
    }

    meal.daily_nutrition.total_kcal -= meal.meal_kcal;

    if (meal.daily_nutrition.total_kcal < 0) {
      meal.daily_nutrition.total_kcal = 0;
    }

    await this.dailyRepo.save(meal.daily_nutrition);
    await this.mealRepo.remove(meal);

    return { message: this.i18n.t('nutrition.mealDeleted') };
  }

  async searchHistory(userId: string, query: SearchHistoryDto) {
    const { startDate, endDate, keyword, mealType } = query;

    const qb = this.mealRepo
      .createQueryBuilder('meal')
      .innerJoinAndSelect('meal.daily_nutrition', 'daily')
      .leftJoinAndSelect('meal.items', 'item')
      .where('daily.user_id = :userId', { userId });

    if (startDate) {
      qb.andWhere('daily.date >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('daily.date <= :endDate', { endDate });
    }

    if (mealType) {
      qb.andWhere('meal.meal_type = :mealType', { mealType });
    }

    if (keyword) {
      qb.andWhere(
        '(item.food_name_vi ILIKE :keyword OR item.food_name_en ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    qb.orderBy('daily.date', 'DESC').addOrderBy('meal.logged_at', 'DESC');

    const meals = await qb.getMany();

    return meals.map((meal) => ({
      meal_id: meal.id,
      date: meal.daily_nutrition.date,
      meal_type: meal.meal_type,
      meal_kcal: meal.meal_kcal,
      is_safe: meal.is_safe,
      summary: meal.items.map((item) => item.food_name_vi).join(', '),
      items: meal.items,
    }));
  }

  async getWeeklyStats(userId: string) {
    const dates = dateRange();
    const startDate = dates[0];
    const endDate = localDate();

    const stats = await this.dailyRepo
      .createQueryBuilder('daily')
      .where('daily.user_id = :userId', { userId })
      .andWhere('daily.date >= :startDate', { startDate })
      .andWhere('daily.date <= :endDate', { endDate })
      .orderBy('daily.date', 'ASC')
      .getMany();

    return dates.map(
      (date) =>
        stats.find((row) => row.date === date) ?? {
          date,
          total_kcal: 0,
          total_burned_kcal: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
        },
    );
  }

  async getMacroTargets(userId: string) {
    const user = await this.usersService.getMe(userId);
    const profile = user.profile;

    if (!profile) {
      throw new NotFoundException(this.i18n.t('nutrition.profileRequired'));
    }

    const tdee = profile.daily_kcal_target || 2000;
    const diet = profile.diet_type || 'STANDARD';

    let pPct = 0.2;
    let cPct = 0.5;
    let fPct = 0.3;

    switch (diet) {
      case 'KETO':
        pPct = 0.25;
        cPct = 0.05;
        fPct = 0.7;
        break;
      case 'VEGAN':
        pPct = 0.2;
        cPct = 0.55;
        fPct = 0.25;
        break;
      case 'PALEO':
        pPct = 0.3;
        cPct = 0.3;
        fPct = 0.4;
        break;
      default:
        break;
    }

    return {
      diet_type: diet,
      daily_kcal_target: tdee,
      target_protein_g: Math.round((tdee * pPct) / 4),
      target_carbs_g: Math.round((tdee * cPct) / 4),
      target_fat_g: Math.round((tdee * fPct) / 9),
    };
  }
}
