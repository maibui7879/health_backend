import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { InsightsService } from '../insights/insights.service';
import { UsersService } from '../users/users.service';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';
import { Meal } from './entities/meal.entity';
import { NutritionPlan } from './entities/nutrition-plan.entity';
import { SuggestService } from './suggest.service';

describe('SuggestService', () => {
  let service: SuggestService;

  const foods = [
    {
      id: 'f1',
      food_name_vi: 'Ức gà luộc',
      food_name_en: 'Boiled chicken breast',
      kcal_100g: 150,
      protein_100g: 30,
      carbs_100g: 0,
      fat_100g: 3.5,
      source: 'VFCT 2007',
    },
    {
      id: 'f2',
      food_name_vi: 'Bánh chocolate',
      food_name_en: 'Chocolate cake',
      kcal_100g: 450,
      protein_100g: 5,
      carbs_100g: 60,
      fat_100g: 20,
      source: 'estimate',
    },
    {
      id: 'f3',
      food_name_vi: 'Đậu phộng rang',
      food_name_en: 'Roasted peanuts',
      kcal_100g: 570,
      protein_100g: 26,
      carbs_100g: 16,
      fat_100g: 49,
      source: 'VFCT 2007',
    },
  ] as Food[];

  const qb = (meals: Partial<Meal>[]) => ({
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(meals),
  });
  const mockFoodRepo = {
    find: jest.fn(() => Promise.resolve(foods)),
    query: jest.fn(),
  };
  const mockMealRepo = { createQueryBuilder: jest.fn(() => qb([])) };
  const mockPlanRepo = { find: jest.fn(() => Promise.resolve([])) };
  const mockUsersService = {
    getMe: jest.fn(() =>
      Promise.resolve({
        profile: { goal_type: 'LOSE_WEIGHT', diet_type: 'STANDARD' },
        allergies: [{ allergen_name: 'đậu phộng' }],
      }),
    ),
  };
  const mockFavRepo = { find: jest.fn(() => Promise.resolve([])) };
  const mockInsights = {
    getProfile: jest.fn(() =>
      Promise.resolve({
        liked_tags: { gà: 5 },
        disliked_tags: {},
        workout_prefs: {},
        interactions: 30,
        weight: 1,
        topLiked: [],
        topDisliked: [],
        topWorkouts: [],
      }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestService,
        { provide: getRepositoryToken(Food), useValue: mockFoodRepo },
        { provide: getRepositoryToken(Meal), useValue: mockMealRepo },
        { provide: getRepositoryToken(NutritionPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(FavoriteFood), useValue: mockFavRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: InsightsService, useValue: mockInsights },
      ],
    }).compile();
    service = module.get<SuggestService>(SuggestService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loại món dị ứng, xếp gà nhất (taste + goal_fit)', async () => {
    const res = await service.suggest('u1', {});
    const names = res.suggestions.map((s) => s.food_name_vi);
    expect(names).not.toContain('Đậu phộng rang');
    expect(names[0]).toBe('Ức gà luộc');
    const top = res.suggestions[0];
    expect(top?.reasons.map((r) => r.code)).toContain('taste_match');
    expect(top?.reasons.map((r) => r.code)).toContain('goal_fit');
    expect(top?.score.taste).toBeGreaterThan(0);
    expect(res.meta).toMatchObject({ goal: 'LOSE_WEIGHT', taste_weight: 1 });
  });

  it('VEGAN loại món mặn (ràng buộc cứng)', async () => {
    mockUsersService.getMe.mockResolvedValueOnce({
      profile: { goal_type: 'MAINTAIN', diet_type: 'VEGAN' },
      allergies: [],
    });
    const res = await service.suggest('u1', {});
    const names = res.suggestions.map((s) => s.food_name_vi);
    expect(names).not.toContain('Ức gà luộc');
  });

  it('món mới ăn 3 ngày qua bị phạt variety', async () => {
    mockMealRepo.createQueryBuilder.mockReturnValueOnce(
      qb([{ items: [{ food_name_vi: 'Ức gà luộc' }] } as Partial<Meal>]),
    );
    const res = await service.suggest('u1', {});
    const top = res.suggestions.find((s) => s.food_name_vi === 'Ức gà luộc');
    expect(top?.score.recent_penalty).toBe(1.5);
  });

  it('không profile vẫn gợi ý với mặc định MAINTAIN', async () => {
    mockUsersService.getMe.mockRejectedValueOnce(new Error('no profile'));
    const res = await service.suggest('u1', { limit: 2 });
    expect(res.suggestions).toHaveLength(2);
    expect(res.meta.goal).toBe('MAINTAIN');
  });

  it('cầu đồng nghĩa vi-en: taste "chicken" khớp món "Gà"', async () => {
    mockInsights.getProfile.mockResolvedValueOnce({
      liked_tags: { chicken: 4 },
      disliked_tags: {},
      workout_prefs: {},
      interactions: 30,
      weight: 1,
      topLiked: [],
      topDisliked: [],
      topWorkouts: [],
    });
    const res = await service.suggest('u1', {});
    const top = res.suggestions.find((s) => s.food_name_vi === 'Ức gà luộc');
    // chicken đồng nghĩa gà/chicken trong cùng món → taste > 0
    expect(top?.score.taste).toBeGreaterThan(0);
  });

  it('discover rỗng khi chưa đủ taste (weight 0)', async () => {
    mockInsights.getProfile.mockResolvedValueOnce({
      liked_tags: {},
      disliked_tags: {},
      workout_prefs: {},
      interactions: 0,
      weight: 0,
      topLiked: [],
      topDisliked: [],
      topWorkouts: [],
    });
    const res = await service.discover('u1', {});
    expect(res).toEqual({
      suggestions: [],
      meta: { reason: 'not_enough_data', taste_weight: 0 },
    });
  });

  it('discover rỗng khi DB chưa backfill embeddings', async () => {
    const res = await service.discover('u1', {});
    expect(res.meta).toMatchObject({
      reason: 'embeddings_pending',
      taste_weight: 1,
    });
    expect(res.suggestions).toEqual([]);
  });

  it('discover trung bình vector món đã thích, loại món đã biết', async () => {
    mockFavRepo.find.mockResolvedValueOnce([
      { food_id: 'f1', food_name_vi: 'Phở bò' },
    ]);
    mockFoodRepo.find.mockResolvedValueOnce([
      { id: 'f1', embedding: '[0.1,0.2]' },
    ]);
    mockFoodRepo.query = jest.fn().mockResolvedValue([
      {
        id: 'f9',
        food_name_vi: 'Bún chả',
        kcal_100g: 140,
        similarity: 0.9511,
      },
    ]);

    const res = await service.discover('u1', { limit: 5 });

    const [sql, params] = mockFoodRepo.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(params[0]).toBe('[0.1,0.2]');
    expect(sql).toContain('id NOT IN');
    expect(res.suggestions).toEqual([
      expect.objectContaining({ id: 'f9', similarity: 0.951 }),
    ]);
    expect(res.meta).toMatchObject({ based_on: 1, taste_weight: 1 });
  });
});
