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

describe('NutritionService.getDailyDashboard warnings', () => {
  const mockDailyRepo = {
    findOne: jest.fn(),
  };
  const mockUsersService = {
    getMe: jest.fn(),
  };

  async function makeService() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(DailyNutrition),
          useValue: mockDailyRepo,
        },
        { provide: getRepositoryToken(Meal), useValue: {} },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();
    return module.get<NutritionService>(NutritionService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersService.getMe.mockResolvedValue({
      profile: { daily_kcal_target: 2000 },
    });
  });

  function dailyWith(
    meals: {
      meal_type: string;
      meal_kcal: number;
      is_safe: boolean;
      logged_at: string;
    }[],
    total: number,
  ) {
    return {
      date: '2026-10-06',
      total_kcal: total,
      meals,
    };
  }

  it('cảnh báo OVER_BUDGET khi vượt 120% target', async () => {
    mockDailyRepo.findOne.mockResolvedValue(
      dailyWith(
        [
          {
            meal_type: 'LUNCH',
            meal_kcal: 2500,
            is_safe: true,
            logged_at: '2026-10-06T12:00:00Z',
          },
        ],
        2500,
      ),
    );
    const svc = await makeService();
    const res = await svc.getDailyDashboard('u1', '2026-10-06');
    expect((res as { warnings: string[] }).warnings).toContain('OVER_BUDGET');
  });

  it('cảnh báo UNDER_BUDGET và UNSAFE_MEAL cùng lúc', async () => {
    mockDailyRepo.findOne.mockResolvedValue(
      dailyWith(
        [
          {
            meal_type: 'SNACK',
            meal_kcal: 800,
            is_safe: false,
            logged_at: '2026-10-06T12:00:00Z',
          },
        ],
        800,
      ),
    );
    const svc = await makeService();
    const res = await svc.getDailyDashboard('u1', '2026-10-06');
    const warnings = (res as { warnings: string[] }).warnings;
    expect(warnings).toContain('UNDER_BUDGET');
    expect(warnings).toContain('UNSAFE_MEAL');
  });

  it('không cảnh báo khi trong ngưỡng và an toàn', async () => {
    mockDailyRepo.findOne.mockResolvedValue(
      dailyWith(
        [
          {
            meal_type: 'LUNCH',
            meal_kcal: 1900,
            is_safe: true,
            logged_at: '2026-10-06T12:00:00Z',
          },
        ],
        1900,
      ),
    );
    const svc = await makeService();
    const res = await svc.getDailyDashboard('u1', '2026-10-06');
    expect((res as { warnings: string[] }).warnings).toEqual([]);
  });

  it('ngày trống trả warnings rỗng', async () => {
    mockDailyRepo.findOne.mockResolvedValue(null);
    const svc = await makeService();
    const res = await svc.getDailyDashboard('u1', '2026-10-06');
    expect((res as { warnings: string[] }).warnings).toEqual([]);
  });
});
