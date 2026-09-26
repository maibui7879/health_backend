import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NutritionService } from './nutrition.service';
import { SearchHistoryDto } from './dto/search-history.dto';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { Meal } from './entities/meal.entity';
import { MealType } from './entities/meal.entity';
import { UsersService } from '../users/users.service';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('NutritionService', () => {
  let service: NutritionService;
  let mockMealRepo: any;

  beforeEach(async () => {
    mockMealRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(DailyNutrition),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Meal),
          useValue: mockMealRepo,
        },
        {
          provide: UsersService,
          useValue: { getMe: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NutritionService>(NutritionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('searchHistory should filter by user, date, keyword and meal type', async () => {
    const query: SearchHistoryDto = {
      startDate: '2026-09-01',
      endDate: '2026-09-12',
      keyword: 'Phở',
      mealType: MealType.LUNCH,
    };

    const meal = {
      id: 'meal-1',
      meal_type: MealType.LUNCH,
      meal_kcal: 540,
      is_safe: true,
      daily_nutrition: { date: '2026-09-12' },
      items: [{ food_name_vi: 'Phở bò', food_name_en: 'Beef Pho' }],
    };

    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([meal]),
    };

    mockMealRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.searchHistory('user-1', query);

    expect(qb.where).toHaveBeenCalledWith('daily.user_id = :userId', {
      userId: 'user-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('daily.date >= :startDate', {
      startDate: '2026-09-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('daily.date <= :endDate', {
      endDate: '2026-09-12',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      '(item.food_name_vi ILIKE :keyword OR item.food_name_en ILIKE :keyword)',
      { keyword: '%Phở%' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('meal.meal_type = :mealType', {
      mealType: MealType.LUNCH,
    });

    expect(result).toEqual([
      {
        meal_id: 'meal-1',
        date: '2026-09-12',
        meal_type: MealType.LUNCH,
        meal_kcal: 540,
        is_safe: true,
        summary: 'Phở bò',
        items: meal.items,
      },
    ]);
  });
});
