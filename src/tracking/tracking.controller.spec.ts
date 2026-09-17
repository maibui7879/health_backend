import { Test, TestingModule } from '@nestjs/testing';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

describe('TrackingController', () => {
  let controller: TrackingController;
  let service: TrackingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackingController],
      providers: [
        {
          provide: TrackingService,
          useValue: {
            createDailyLog: jest.fn(),
            getDailyLog: jest.fn(),
            updateDailyLog: jest.fn(),
            deleteDailyLog: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TrackingController>(TrackingController);
    service = module.get<TrackingService>(TrackingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate createDailyLog to service', async () => {
    const dto = {
      log_date: '2026-09-13',
      water_consumed_ml: 2200,
      total_kcal_in: 1800,
      total_kcal_out: 420,
      weight_log: 68.5,
      is_streak_day: false,
    };

    await controller.createDailyLog('user-1', dto as any);

    expect(service.createDailyLog).toHaveBeenCalledWith('user-1', dto);
  });
});
