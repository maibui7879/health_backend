import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Workout } from './entities/workout.entity';
import { WorkoutGoal, WorkoutGoalStatus } from './entities/workout-goal.entity';
import { WorkoutGoalsService } from './workout-goals.service';
import { localizationMockProvider } from '../i18n/localization.mock';

function log(date: string, media = false, viewed = false): Workout {
  return {
    id: date,
    user_id: 'u1',
    date,
    media_url: media ? '/uploads/workouts/a.mp4' : null,
    media_viewed_at: viewed ? new Date() : null,
  } as Workout;
}

describe('WorkoutGoalsService', () => {
  let service: WorkoutGoalsService;
  const mockGoalRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockWorkoutRepo = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutGoalsService,
        localizationMockProvider,
        { provide: getRepositoryToken(WorkoutGoal), useValue: mockGoalRepo },
        { provide: getRepositoryToken(Workout), useValue: mockWorkoutRepo },
      ],
    }).compile();
    service = module.get<WorkoutGoalsService>(WorkoutGoalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('409 khi đã có ACTIVE', async () => {
    mockGoalRepo.findOne.mockResolvedValue({ id: 'g1' });
    await expect(
      service.createGoal('u1', { target_days: 7 }),
    ).rejects.toThrow();
    expect(mockGoalRepo.save).not.toHaveBeenCalled();
  });

  it('settleOne FAILED khi đứt mạch', async () => {
    const goal = {
      id: 'g1',
      user_id: 'u1',
      target_days: 7,
      start_date: '2026-09-20',
      end_date: '2026-09-26',
      status: WorkoutGoalStatus.ACTIVE,
    } as WorkoutGoal;
    mockWorkoutRepo.find.mockResolvedValue([
      log('2026-09-20'),
      // thiếu 2026-09-21 -> FAILED
      log('2026-09-22'),
    ]);
    mockGoalRepo.save.mockImplementation((g: WorkoutGoal) =>
      Promise.resolve(g),
    );
    const res = await service.settleOne(goal);
    expect(res.status).toBe(WorkoutGoalStatus.FAILED);
  });

  it('settleOne COMPLETED + badge khi đủ ngày', async () => {
    const goal = {
      id: 'g1',
      user_id: 'u1',
      target_days: 7,
      start_date: '2020-01-01',
      end_date: '2020-01-07',
      status: WorkoutGoalStatus.ACTIVE,
    } as WorkoutGoal;
    mockWorkoutRepo.find.mockResolvedValue([
      log('2020-01-01'),
      log('2020-01-02'),
      log('2020-01-03'),
      log('2020-01-04'),
      log('2020-01-05'),
      log('2020-01-06'),
      log('2020-01-07'),
    ]);
    mockGoalRepo.save.mockImplementation((g: WorkoutGoal) =>
      Promise.resolve(g),
    );
    const res = await service.settleOne(goal);
    expect(res.status).toBe(WorkoutGoalStatus.COMPLETED);
    expect(res.badge).toBe('STREAK_7');
  });
});
