import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateMealDto } from './dto/create-meal.dto';
import { SearchHistoryDto } from './dto/search-history.dto';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { Meal } from './entities/meal.entity';
import { MealItem } from './entities/meal-item.entity';

@Injectable()
export class NutritionService {
  constructor(
    @InjectRepository(DailyNutrition)
    private dailyRepo: Repository<DailyNutrition>,
    @InjectRepository(Meal)
    private mealRepo: Repository<Meal>,
    private usersService: UsersService,
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

    return meal;
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

    const diary: Record<string, any[]> = {
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
    };
  }

  async deleteMeal(userId: string, mealId: string) {
    const meal = await this.mealRepo.findOne({
      where: { id: mealId },
      relations: { daily_nutrition: true },
    });

    if (!meal) {
      throw new NotFoundException('Không tìm thấy bữa ăn');
    }

    if (meal.daily_nutrition.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa bữa ăn này');
    }

    meal.daily_nutrition.total_kcal -= meal.meal_kcal;

    if (meal.daily_nutrition.total_kcal < 0) {
      meal.daily_nutrition.total_kcal = 0;
    }

    await this.dailyRepo.save(meal.daily_nutrition);
    await this.mealRepo.remove(meal);

    return { message: 'Đã xóa bữa ăn và cập nhật lại Calories' };
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
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const stats = await this.dailyRepo
      .createQueryBuilder('daily')
      .where('daily.user_id = :userId', { userId })
      .andWhere('daily.date >= :startDate', { startDate })
      .andWhere('daily.date <= :endDate', { endDate })
      .orderBy('daily.date', 'ASC')
      .getMany();

    return stats;
  }

  async getMacroTargets(userId: string) {
    const user = await this.usersService.getMe(userId);
    const profile = user.profile;

    if (!profile) {
      throw new NotFoundException('Chưa cập nhật Profile');
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
