import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { UserTasteProfile } from './entities/user-taste-profile.entity';
import { InsightsService } from './insights.service';
import { tokenizeTaste } from './taste-tokenizer';

describe('tokenizeTaste', () => {
  it.each([
    ['Phở bò', ['phở', 'bò']],
    ['Beef pho', ['beef', 'pho']],
    ['Grilled chicken with rice', ['grilled', 'chicken', 'rice']],
    ['Cơm gà, trứng ốp la!', ['cơm', 'gà', 'trứng', 'ốp', 'la']],
    ['Món ăn với rau', ['rau']],
    ['Vitamin C 1000', ['vitamin']],
    ['The best of both', ['best', 'both']],
    ['', []],
    ['a b c', []],
  ])('tách %p -> %p', (input, expected) => {
    expect(tokenizeTaste(input)).toEqual(expected);
  });
});

describe('InsightsService', () => {
  let service: InsightsService;
  const store = new Map<string, UserTasteProfile>();

  const mockTasteRepo = {
    findOne: jest.fn(({ where }: { where: { user_id: string } }) =>
      Promise.resolve(store.get(where.user_id) ?? null),
    ),
    create: jest.fn((v: Partial<UserTasteProfile>) => ({ ...v })),
    save: jest.fn((p: UserTasteProfile) => {
      store.set(p.user_id, { ...p });
      return Promise.resolve(p);
    }),
    find: jest.fn(() => Promise.resolve([...store.values()])),
  };

  beforeEach(async () => {
    store.clear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        {
          provide: getRepositoryToken(UserTasteProfile),
          useValue: mockTasteRepo,
        },
      ],
    }).compile();
    service = module.get<InsightsService>(InsightsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('recordMeal cộng tag liked + đếm interaction', async () => {
    await service.recordMeal('u1', ['Phở bò', 'Cơm gà']);
    const p = await service.getProfile('u1');
    expect(p.liked_tags).toMatchObject({ phở: 1, bò: 1, cơm: 1, gà: 1 });
    expect(p.interactions).toBe(1);
    expect(p.weight).toBe(0); // cold start: <5 tín hiệu
  });

  it('recordWorkout cộng workout_prefs theo activity', async () => {
    await service.recordWorkout('u1', 'running');
    await service.recordWorkout('u1', 'RUNNING');
    const p = await service.getProfile('u1');
    expect(p.workout_prefs).toEqual({ RUNNING: 2 });
  });

  it('recordPlanSkipped phạt disliked, recordFavorite nhân đôi', async () => {
    await service.recordPlanSkipped('u1', ['Cá hấp gừng']);
    await service.recordFavorite('u1', ['Phở bò']);
    const p = await service.getProfile('u1');
    expect(p.disliked_tags).toMatchObject({ cá: 0.5, hấp: 0.5, gừng: 0.5 });
    expect(p.liked_tags).toMatchObject({ phở: 2, bò: 2 });
  });

  it('weight = 1 khi đủ già và đủ tín hiệu', async () => {
    const old = new Date(Date.now() - 20 * 86400000);
    store.set('u1', {
      user_id: 'u1',
      liked_tags: { phở: 30 },
      disliked_tags: {},
      workout_prefs: {},
      interactions: 30,
      created_at: old,
      updated_at: old,
    });
    const p = await service.getProfile('u1');
    expect(p.weight).toBe(1);
    expect(p.topLiked).toEqual([{ tag: 'phở', score: 30 }]);
  });

  it('weight = 0 khi profile non (<14 ngày) dù nhiều tín hiệu', async () => {
    const fresh = new Date(Date.now() - 2 * 86400000);
    store.set('u1', {
      user_id: 'u1',
      liked_tags: { phở: 50 },
      disliked_tags: {},
      workout_prefs: {},
      interactions: 50,
      created_at: fresh,
      updated_at: fresh,
    });
    expect((await service.getProfile('u1')).weight).toBe(0);
  });

  it('decay làm mờ điểm và tỉa tag < 0.05', async () => {
    const now = new Date();
    store.set('u1', {
      user_id: 'u1',
      liked_tags: { phở: 10, lạ: 0.04 },
      disliked_tags: {},
      workout_prefs: { RUNNING: 5 },
      interactions: 3,
      created_at: now,
      updated_at: now,
    });
    const { pruned } = await service.decayTaste();
    const p = store.get('u1');
    expect(p?.liked_tags['phở']).toBeCloseTo(10 * Math.pow(0.5, 1 / 90), 2);
    expect(p?.liked_tags['lạ']).toBeUndefined();
    expect(pruned).toBe(1);
  });

  it('record nuốt lỗi DB, không throw', async () => {
    mockTasteRepo.findOne.mockRejectedValueOnce(new Error('db down'));
    await expect(service.recordMeal('u1', ['Phở'])).resolves.toBeUndefined();
  });
});
