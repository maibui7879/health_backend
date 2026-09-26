import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyLog } from './entities/daily-log.entity';
import { TrackingService } from './tracking.service';
import { UsersService } from '../users/users.service';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('TrackingService', () => {
  let service: TrackingService;
  let mockDailyLogRepo: any;
  let mockUsersService: any;

  beforeEach(async () => {
    mockDailyLogRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    mockUsersService = {
      updateProfile: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(DailyLog),
          useValue: mockDailyLogRepo,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createDailyLog should save a new log when none exists', async () => {
    mockDailyLogRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockDailyLogRepo.create.mockReturnValue({
      user_id: 'user-1',
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
      weight_log: 68.5,
      is_streak_day: false,
    });
    mockDailyLogRepo.save.mockResolvedValue({
      id: 'log-1',
      user_id: 'user-1',
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
      weight_log: 68.5,
      is_streak_day: false,
    });

    const result = await service.createDailyLog('user-1', {
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
      weight_log: 68.5,
    });

    expect(mockDailyLogRepo.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
      weight_log: 68.5,
      is_streak_day: false,
    });
    expect(mockUsersService.updateProfile).toHaveBeenCalledWith('user-1', {
      current_weight_kg: 68.5,
    });
    expect(result).toHaveProperty('id', 'log-1');
  });

  it('createDailyLog should calculate streak from the previous day', async () => {
    mockDailyLogRepo.findOne
      .mockResolvedValueOnce({ id: 'previous-log' })
      .mockResolvedValueOnce(null);
    mockDailyLogRepo.create.mockReturnValue({});
    mockDailyLogRepo.save.mockResolvedValue({ id: 'log-2' });

    await service.createDailyLog('user-1', {
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
    });

    expect(mockDailyLogRepo.findOne).toHaveBeenNthCalledWith(1, {
      where: { user_id: 'user-1', log_date: '2026-09-12' },
    });
    expect(mockDailyLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_streak_day: true }),
    );
  });
});
