import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { localizationMockProvider } from '../i18n/localization.mock';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { UsersService } from '../users/users.service';
import { Workout } from '../workout/entities/workout.entity';
import { DailyNutrition } from './entities/daily-nutrition.entity';
import { Meal } from './entities/meal.entity';
import { NutritionPlan, PlanStatus } from './entities/nutrition-plan.entity';
import { NutritionPlansService } from './plans.service';

describe('NutritionPlansService', () => {
  let service: NutritionPlansService;

  const mockPlanRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockMealRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockWorkoutRepo = { find: jest.fn() };
  const mockLogRepo = { findOne: jest.fn() };
  const mockDailyRepo = { findOne: jest.fn() };
  const mockUsersService = { getMe: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutritionPlansService,
        localizationMockProvider,
        { provide: getRepositoryToken(NutritionPlan), useValue: mockPlanRepo },
        { provide: getRepositoryToken(Meal), useValue: mockMealRepo },
        { provide: getRepositoryToken(Workout), useValue: mockWorkoutRepo },
        { provide: getRepositoryToken(DailyLog), useValue: mockLogRepo },
        {
          provide: getRepositoryToken(DailyNutrition),
          useValue: mockDailyRepo,
        },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<NutritionPlansService>(NutritionPlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('abandons old actives and defaults date_to to +6 days', async () => {
      mockPlanRepo.update.mockResolvedValue({});
      mockPlanRepo.create.mockImplementation((v: Record<string, unknown>) => v);
      mockPlanRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 'p1', ...v }),
      );

      const res = await service.create('u1', {
        date_from: '2026-10-05',
        items: [{ day: 1 }],
      });

      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1', status: PlanStatus.ACTIVE, is_template: false },
        { status: PlanStatus.ABANDONED },
      );
      expect(res.plan).toMatchObject({
        date_from: '2026-10-05',
        date_to: '2026-10-11',
        status: PlanStatus.ACTIVE,
      });
    });

    it('rejects end date before start date', async () => {
      await expect(
        service.create('u1', {
          date_from: '2026-10-11',
          date_to: '2026-10-05',
          items: [{ day: 1 }],
        }),
      ).rejects.toThrow('nutrition.planBadRange');
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('throws NotFound for missing', async () => {
      mockPlanRepo.findOne.mockResolvedValue(null);
      await expect(service.getOne('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws Forbidden for other user', async () => {
      mockPlanRepo.findOne.mockResolvedValue({ id: 'p1', user_id: 'other' });
      await expect(service.getOne('u1', 'p1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('reactivating abandons other actives first', async () => {
      mockPlanRepo.findOne.mockResolvedValue({
        id: 'p1',
        user_id: 'u1',
        status: PlanStatus.ABANDONED,
      });
      mockPlanRepo.update.mockResolvedValue({});
      mockPlanRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve(v),
      );

      const res = await service.update('u1', 'p1', {
        status: PlanStatus.ACTIVE,
      });

      expect(mockPlanRepo.update).toHaveBeenCalledWith(
        { user_id: 'u1', status: PlanStatus.ACTIVE, is_template: false },
        { status: PlanStatus.ABANDONED },
      );
      expect(res.plan).toMatchObject({ status: PlanStatus.ACTIVE });
    });

    it('completing does not touch other actives', async () => {
      mockPlanRepo.findOne.mockResolvedValue({
        id: 'p1',
        user_id: 'u1',
        status: PlanStatus.ACTIVE,
      });
      mockPlanRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve(v),
      );

      await service.update('u1', 'p1', { status: PlanStatus.COMPLETED });

      expect(mockPlanRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('adherence', () => {
    const plan = {
      id: 'p1',
      user_id: 'u1',
      date_from: '2026-10-05',
      date_to: '2026-10-11',
      status: PlanStatus.ACTIVE,
      items: [
        {
          day: 1,
          meals: [
            { meal_type: 'BREAKFAST', suggestion: 'Oatmeal', kcal: 400 },
            { meal_type: 'LUNCH', suggestion: 'Chicken rice', kcal: 600 },
          ],
          workout: { activity: 'Running', duration_minutes: 30 },
        },
      ],
    };

    function mockActuals(overrides: {
      meals?: unknown[];
      workouts?: unknown[];
      log?: unknown;
      profile?: Record<string, unknown>;
    }) {
      mockPlanRepo.findOne.mockResolvedValue(plan);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(overrides.meals ?? []),
      };
      mockMealRepo.createQueryBuilder.mockReturnValue(qb);
      mockWorkoutRepo.find.mockResolvedValue(overrides.workouts ?? []);
      mockLogRepo.findOne.mockResolvedValue(overrides.log ?? null);
      mockUsersService.getMe.mockResolvedValue({
        profile: overrides.profile ?? { daily_water_target: 2000 },
        allergies: [],
      });
    }

    it('scores ON_TRACK when actuals match plan', async () => {
      mockActuals({
        meals: [
          {
            meal_type: 'BREAKFAST',
            meal_kcal: 400,
            items: [{ food_name_vi: 'Oatmeal' }],
          },
          {
            meal_type: 'LUNCH',
            meal_kcal: 600,
            items: [{ food_name_vi: 'Chicken rice' }],
          },
        ],
        workouts: [{ activity_type: 'RUNNING', duration_minutes: 30 }],
        log: { water_consumed_ml: 2000, weight_log: 70 },
      });

      const res = await service.adherence('u1', '2026-10-05', 'p1');

      expect(res.verdict).toBe('ON_TRACK');
      expect(res.scores.overall).toBe(100);
      expect(res.actual.kcal).toBe(1000);
      expect(res.planned.kcal).toBe(1000);
    });

    it('scores OFF_TRACK when far off plan', async () => {
      mockActuals({
        meals: [{ meal_type: 'SNACK', meal_kcal: 2000, items: [] }],
        workouts: [],
        log: { water_consumed_ml: 0, weight_log: null },
      });

      const res = await service.adherence('u1', '2026-10-05', 'p1');

      expect(res.verdict).toBe('OFF_TRACK');
      expect((res.scores.overall as number) < 50).toBe(true);
    });

    it('throws when date is outside plan range', async () => {
      mockPlanRepo.findOne.mockResolvedValue(plan);

      await expect(service.adherence('u1', '2026-11-01', 'p1')).rejects.toThrow(
        'nutrition.noPlanCoverage',
      );
    });

    it('resolves active plan when no id given', async () => {
      mockPlanRepo.find.mockResolvedValue([plan]);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockMealRepo.createQueryBuilder.mockReturnValue(qb);
      mockWorkoutRepo.find.mockResolvedValue([]);
      mockLogRepo.findOne.mockResolvedValue(null);
      mockUsersService.getMe.mockRejectedValue(new Error('no user'));

      const res = await service.adherence('u1', '2026-10-05');

      expect(res.plan_id).toBe('p1');
      expect(res.verdict).toBe('OFF_TRACK');
    });
  });

  describe('publish', () => {
    const completedPlan = {
      id: 'p1',
      user_id: 'u1',
      status: PlanStatus.COMPLETED,
      title: 'Tuan 1',
      date_from: '2026-09-20',
      date_to: '2026-09-20',
      goal_summary: 'Giam can',
      goal_snapshot: null,
      items: [
        {
          day: 1,
          meals: [{ meal_type: 'LUNCH', suggestion: 'Com ga', kcal: 600 }],
        },
      ],
    };

    function mockFullDay() {
      mockPlanRepo.findOne.mockResolvedValue(completedPlan);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            meal_type: 'LUNCH',
            meal_kcal: 600,
            items: [{ food_name_vi: 'Com ga' }],
          },
        ]),
      };
      mockMealRepo.createQueryBuilder.mockReturnValue(qb);
      mockWorkoutRepo.find.mockResolvedValue([]);
      mockLogRepo.findOne.mockResolvedValue(null);
      mockUsersService.getMe.mockResolvedValue({
        profile: { daily_water_target: 2000 },
        allergies: [],
      });
      mockPlanRepo.create.mockImplementation((v: Record<string, unknown>) => v);
      mockPlanRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 't1', ...v }),
      );
    }

    it('publishes completed plan with good score as detached template', async () => {
      mockFullDay();

      const res = await service.publish('u1', 'p1', {});

      expect(mockPlanRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_template: true, use_count: 0 }),
      );
      expect(res.plan).toMatchObject({ id: 't1' });
    });

    it('rejects non-completed plan', async () => {
      mockPlanRepo.findOne.mockResolvedValue({
        ...completedPlan,
        status: PlanStatus.ACTIVE,
      });

      await expect(service.publish('u1', 'p1', {})).rejects.toThrow(
        'nutrition.planNotCompleted',
      );
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });

    it('rejects low average score', async () => {
      mockPlanRepo.findOne.mockResolvedValue(completedPlan);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { meal_type: 'SNACK', meal_kcal: 2000, items: [] },
          ]),
      };
      mockMealRepo.createQueryBuilder.mockReturnValue(qb);
      mockWorkoutRepo.find.mockResolvedValue([]);
      mockLogRepo.findOne.mockResolvedValue(null);
      mockUsersService.getMe.mockResolvedValue({
        profile: { daily_water_target: 2000 },
        allergies: [],
      });

      await expect(service.publish('u1', 'p1', {})).rejects.toThrow(
        'nutrition.planScoreLow',
      );
      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('clone', () => {
    it('copies template into own ACTIVE plan and bumps use_count', async () => {
      const template = {
        id: 't1',
        user_id: 'author',
        is_template: true,
        title: 'Mau giam can',
        goal_summary: 'Giam can',
        goal_snapshot: null,
        items: [{ day: 1 }, { day: 2 }],
      };
      mockPlanRepo.findOne.mockResolvedValue(template);
      mockUsersService.getMe.mockResolvedValue({
        profile: {
          daily_kcal_target: 1800,
          goal_type: 'LOSE_WEIGHT',
          diet_type: 'STANDARD',
        },
        allergies: [],
      });
      mockPlanRepo.update.mockResolvedValue({});
      mockPlanRepo.create.mockImplementation((v: Record<string, unknown>) => v);
      mockPlanRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 'p9', ...v }),
      );
      const uqb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      mockPlanRepo.createQueryBuilder.mockReturnValue(uqb);

      const res = await service.clone('u1', 't1', { start_date: '2026-10-13' });

      expect(mockPlanRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          date_from: '2026-10-13',
          date_to: '2026-10-14',
          is_template: false,
        }),
      );
      expect(uqb.execute).toHaveBeenCalled();
      expect(res.plan).toMatchObject({ id: 'p9' });
    });

    it('404s on non-template plan', async () => {
      mockPlanRepo.findOne.mockResolvedValue(null);

      await expect(
        service.clone('u1', 'nope', { start_date: '2026-10-13' }),
      ).rejects.toThrow('nutrition.templateNotFound');
    });
  });

  describe('listTemplates', () => {
    it('returns templates with author names', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([
            [{ id: 't1', user: { profile: { full_name: 'An' } } }],
            1,
          ]),
      };
      mockPlanRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.listTemplates({ sort: 'hot' });

      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({ author_name: 'An' });
    });
  });
});
