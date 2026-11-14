import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyLog } from './entities/daily-log.entity';
import { TrackingService } from './tracking.service';
import { UsersService } from '../users/users.service';
import { localizationMockProvider } from '../i18n/localization.mock';
import { localDate } from '../common/local-date';

describe('TrackingService', () => {
  let service: TrackingService;
  const repo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
  };
  const users = { getMe: jest.fn(), updateProfile: jest.fn() };
  beforeEach(async () => {
    jest.resetAllMocks();
    repo.findOne.mockResolvedValue(null);
    repo.create.mockImplementation((value: unknown) => value);
    repo.save.mockImplementation((value: object) =>
      Promise.resolve({ id: 'log-1', ...value }),
    );
    repo.query.mockResolvedValue([
      { total_kcal_in: 450.5, total_kcal_out: 120 },
    ]);
    users.getMe.mockResolvedValue({ profile: { daily_water_target: 2000 } });
    const module = await Test.createTestingModule({
      providers: [
        TrackingService,
        localizationMockProvider,
        { provide: getRepositoryToken(DailyLog), useValue: repo },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(TrackingService);
  });

  it('uses nutrition totals instead of client-supplied calories', async () => {
    const result = await service.createDailyLog('u1', {
      log_date: localDate(),
      water_consumed_ml: 0,
      total_kcal_in: 9999,
      total_kcal_out: 9999,
    });
    expect(result.total_kcal_in).toBe(450.5);
    expect(result.total_kcal_out).toBe(120);
    expect(result.is_streak_day).toBe(false);
  });

  it('counts water only when the daily target is reached', async () => {
    const result = await service.createDailyLog('u1', {
      log_date: localDate(),
      water_consumed_ml: 2000,
    });
    expect(result.is_streak_day).toBe(true);
    const below = await service.createDailyLog('u1', {
      log_date: localDate(),
      water_consumed_ml: 1999,
    });
    expect(below.is_streak_day).toBe(false);
  });

  it('does not replace the current profile with a backdated weight', async () => {
    await service.createDailyLog('u1', {
      log_date: '2020-01-01',
      water_consumed_ml: 0,
      weight_log: 80,
    });
    expect(users.updateProfile).not.toHaveBeenCalled();
    await service.createDailyLog('u1', {
      log_date: localDate(),
      water_consumed_ml: 0,
      weight_log: 70,
    });
    expect(users.updateProfile).toHaveBeenCalledWith('u1', {
      current_weight_kg: 70,
    });
  });

  it('returns canonical calories even when no tracking row exists', async () => {
    const result = await service.getDailyLog('u1', localDate());
    expect(result).toMatchObject({
      water_consumed_ml: 0,
      total_kcal_in: 450.5,
    });
  });

  it('rejects invalid dates and moving a daily log to another day', async () => {
    await expect(service.getDailyLog('u1', '2026-02-30')).rejects.toThrow();
    repo.findOne.mockResolvedValue({ id: 'log-1', log_date: '2020-01-01' });
    await expect(
      service.updateDailyLog('u1', 'log-1', { log_date: '2020-01-02' }),
    ).rejects.toThrow();
  });
});
