import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { WorkoutService } from './workout.service';
import { Workout, ActivityType } from './entities/workout.entity';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('WorkoutService', () => {
  let service: WorkoutService;
  let mockWorkoutRepo: any;
  let mockDailyRepo: any;

  beforeEach(async () => {
    mockWorkoutRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    mockDailyRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(Workout),
          useValue: mockWorkoutRepo,
        },
        {
          provide: getRepositoryToken(DailyNutrition),
          useValue: mockDailyRepo,
        },
      ],
    }).compile();

    service = module.get<WorkoutService>(WorkoutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createWorkout should save workout and increment total_burned_kcal', async () => {
    const dto = {
      activity_type: ActivityType.RUNNING,
      duration_minutes: 30,
      burned_kcal: 350,
      date: '2026-09-13',
    };

    const daily = {
      id: 'daily-1',
      user_id: 'user-1',
      date: '2026-09-13',
      total_kcal: 1800,
      total_burned_kcal: 100,
    };

    mockDailyRepo.findOne.mockResolvedValue(daily);
    mockWorkoutRepo.create.mockReturnValue({ ...dto, user_id: 'user-1' });
    mockWorkoutRepo.save.mockResolvedValue({ ...dto, user_id: 'user-1' });
    mockDailyRepo.save.mockResolvedValue({ ...daily, total_burned_kcal: 450 });

    const result = await service.createWorkout('user-1', dto);

    expect(mockDailyRepo.findOne).toHaveBeenCalledWith({
      where: { user_id: 'user-1', date: '2026-09-13' },
    });
    expect(mockWorkoutRepo.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      activity_type: dto.activity_type,
      duration_minutes: dto.duration_minutes,
      burned_kcal: dto.burned_kcal,
      date: dto.date,
    });
    expect(daily.total_burned_kcal).toBe(450);
    expect(result).toEqual({ ...dto, user_id: 'user-1' });
  });
});
