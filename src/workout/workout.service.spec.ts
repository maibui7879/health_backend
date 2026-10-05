import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyNutrition } from '../nutrition/entities/daily-nutrition.entity';
import { WorkoutService } from './workout.service';
import { Workout, ActivityType } from './entities/workout.entity';
import { ExerciseTemplatesService } from './exercise-templates.service';
import { localizationMockProvider } from '../i18n/localization.mock';
import { insightsMockProvider } from '../insights/insights.mock';

describe('WorkoutService', () => {
  let service: WorkoutService;
  let templatesMock: { mustExist: jest.Mock };
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
        insightsMockProvider,
        {
          provide: ExerciseTemplatesService,
          useValue: { mustExist: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<WorkoutService>(WorkoutService);
    templatesMock = module.get(ExerciseTemplatesService);
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
      media_url: null,
      media_type: null,
      template_id: null,
    });
    expect(daily.total_burned_kcal).toBe(450);
    expect(result).toEqual({ ...dto, user_id: 'user-1' });
  });

  it('attachMedia gắn file, set kind, reset viewed', async () => {
    const workout = {
      id: 'w1',
      user_id: 'user-1',
      media_url: null,
      media_type: null,
      media_viewed_at: new Date(),
    };
    mockWorkoutRepo.findOne.mockResolvedValue(workout);
    mockWorkoutRepo.save.mockImplementation((w: any) => Promise.resolve(w));

    const res = await service.attachMedia('user-1', 'w1', 'w1-1.mp4', 'video');

    expect(res.media_url).toBe('/uploads/workouts/w1-1.mp4');
    expect(res.media_type).toBe('video');
    expect(res.media_viewed_at).toBeNull();
  });

  it('markViewed idempotent, 404 khi chưa có media', async () => {
    mockWorkoutRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.markViewed('user-1', 'nope')).rejects.toThrow();

    mockWorkoutRepo.findOne.mockResolvedValueOnce({
      id: 'w2',
      user_id: 'user-1',
      media_url: null,
    });
    await expect(service.markViewed('user-1', 'w2')).rejects.toThrow();

    const at = new Date('2026-10-01T00:00:00.000Z');
    mockWorkoutRepo.findOne.mockResolvedValue({
      id: 'w3',
      user_id: 'user-1',
      media_url: '/uploads/workouts/a.mp4',
      media_viewed_at: at,
    });
    mockWorkoutRepo.save.mockImplementation((w: any) => Promise.resolve(w));
    const res = await service.markViewed('user-1', 'w3');
    expect(res.media_viewed_at).toBe(at);
    expect(mockWorkoutRepo.save).not.toHaveBeenCalled();
  });

  it('createWorkout với template_id neo activity theo template', async () => {
    const dto = {
      activity_type: ActivityType.RUNNING,
      duration_minutes: 30,
      burned_kcal: 350,
      date: '2026-09-13',
      template_id: 'tpl-1',
    };
    mockDailyRepo.findOne.mockResolvedValue({
      total_burned_kcal: 0,
      date: dto.date,
      user_id: 'user-1',
    });
    mockDailyRepo.save.mockImplementation((d: any) => Promise.resolve(d));
    const created: any = {};
    mockWorkoutRepo.create.mockImplementation((v: any) =>
      Object.assign(created, v),
    );
    mockWorkoutRepo.save.mockImplementation((w: any) => Promise.resolve(w));
    templatesMock.mustExist.mockResolvedValue({
      id: 'tpl-1',
      activity_type: ActivityType.YOGA,
    });

    const res = await service.createWorkout('user-1', dto);

    expect(templatesMock.mustExist).toHaveBeenCalledWith('tpl-1');
    expect(res.activity_type).toBe(ActivityType.YOGA);
    expect(res.template_id).toBe('tpl-1');
  });
});
