import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { InsightsService } from '../insights/insights.service';
import { ActivityType, Workout } from './entities/workout.entity';
import { SuggestWorkoutService } from './suggest-workout.service';

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - n * 86400000).toISOString().split('T')[0];
}

function w(
  activity_type: ActivityType,
  daysAgo: number,
  duration_minutes = 30,
): Workout {
  return {
    id: `${activity_type}-${daysAgo}`,
    user_id: 'u1',
    activity_type,
    duration_minutes,
    burned_kcal: 200,
    date: isoDaysAgo(daysAgo),
  } as Workout;
}

describe('SuggestWorkoutService', () => {
  let service: SuggestWorkoutService;

  const mockWorkoutRepo = { find: jest.fn() };
  const mockInsights = {
    getProfile: jest.fn(() =>
      Promise.resolve({
        liked_tags: {},
        disliked_tags: {},
        workout_prefs: {},
        interactions: 0,
        weight: 0,
        topLiked: [],
        topDisliked: [],
        topWorkouts: [],
      }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestWorkoutService,
        { provide: getRepositoryToken(Workout), useValue: mockWorkoutRepo },
        { provide: InsightsService, useValue: mockInsights },
      ],
    }).compile();
    service = module.get<SuggestWorkoutService>(SuggestWorkoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hôm qua chạy bộ → ưu tiên nhóm cơ tươi (tay/core)', async () => {
    mockWorkoutRepo.find.mockResolvedValue([w(ActivityType.RUNNING, 1)]);
    const res = await service.suggest('u1', {});
    expect(res.suggestions[0]?.activity_type).toBe(ActivityType.WEIGHT_LIFTING);
    expect(res.suggestions[0]?.reasons.map((r) => r.code)).toContain(
      'rotation_recovery',
    );
    expect(res.meta.trained_yesterday_groups).toEqual(
      expect.arrayContaining(['legs', 'cardio']),
    );
  });

  it('tập 5 ngày liên tiếp → gợi ý nghỉ lên đầu', async () => {
    mockWorkoutRepo.find.mockResolvedValue([
      w(ActivityType.RUNNING, 0),
      w(ActivityType.CYCLING, 1),
      w(ActivityType.YOGA, 2),
      w(ActivityType.SWIMMING, 3),
      w(ActivityType.CARDIO, 4),
    ]);
    const res = await service.suggest('u1', {});
    expect(res.suggestions[0]?.rest).toBe(true);
    expect(res.meta.streak_days).toBeGreaterThanOrEqual(5);
  });

  it('tăng tải +5% làm tròn 5 phút theo lịch sử', async () => {
    mockWorkoutRepo.find.mockResolvedValue([
      w(ActivityType.YOGA, 1),
      w(ActivityType.RUNNING, 3, 50),
    ]);
    const res = await service.suggest('u1', {});
    const run = res.suggestions.find(
      (s) => s.activity_type === ActivityType.RUNNING,
    );
    expect(run?.duration_minutes).toBe(55);
    expect(run?.reasons.map((r) => r.code)).toContain('progression');
  });

  it('gu ngầm đẩy môn yêu thích lên (SWIMMING)', async () => {
    mockWorkoutRepo.find.mockResolvedValue([]);
    mockInsights.getProfile.mockResolvedValueOnce({
      liked_tags: {},
      disliked_tags: {},
      workout_prefs: { SWIMMING: 10 },
      interactions: 30,
      weight: 1,
      topLiked: [],
      topDisliked: [],
      topWorkouts: [],
    });
    const res = await service.suggest('u1', {});
    expect(res.suggestions[0]?.activity_type).toBe(ActivityType.SWIMMING);
    expect(res.suggestions[0]?.reasons.map((r) => r.code)).toContain(
      'taste_match',
    );
  });

  it('chưa có lịch sử → mặc định 30 phút, taste weight 0', async () => {
    mockWorkoutRepo.find.mockResolvedValue([]);
    const res = await service.suggest('u1', { limit: 6 });
    expect(res.suggestions).toHaveLength(6);
    expect(res.suggestions.every((s) => s.duration_minutes === 30)).toBe(true);
    expect(res.meta).toMatchObject({ streak_days: 0, taste_weight: 0 });
  });
});
