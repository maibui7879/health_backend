import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
  })),
}));
import { Food } from './entities/food.entity';
import {
  FoodSubmission,
  SubmissionStatus,
} from './entities/food-submission.entity';
import { ModerationService } from './moderation.service';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('ModerationService', () => {
  let service: ModerationService;
  const mockSubmissionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockFoodRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(FoodSubmission),
          useValue: mockSubmissionRepo,
        },
        { provide: getRepositoryToken(Food), useValue: mockFoodRepo },
        {
          provide: NotificationsService,
          useValue: { notify: jest.fn(() => Promise.resolve(null)) },
        },
      ],
    }).compile();
    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submit tạo PENDING', async () => {
    mockSubmissionRepo.create.mockImplementation((v: unknown) => v);
    mockSubmissionRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));
    const res = await service.submit('u1', { food_name_vi: 'Món mới' });
    expect(mockSubmissionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', status: SubmissionStatus.PENDING }),
    );
    expect(res.submission).toMatchObject({ food_name_vi: 'Món mới' });
  });

  it('approve sinh foods code USER-* + source user', async () => {
    const sub = {
      id: '12345678-aaaa-bbbb-cccc-ddeeff001122',
      food_name_vi: 'Món mới',
      food_name_en: null,
      kcal_100g: 100,
      protein_100g: 5,
      carbs_100g: 10,
      fat_100g: 2,
      image_url: null,
      status: SubmissionStatus.PENDING,
    };
    mockSubmissionRepo.findOne.mockResolvedValue(sub);
    mockFoodRepo.findOne.mockResolvedValue(null);
    mockFoodRepo.create.mockImplementation((v: unknown) => v);
    mockFoodRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));
    mockSubmissionRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

    const res = await service.approve('admin1', sub.id);

    expect(mockFoodRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'USER-12345678', source: 'user' }),
    );
    expect(res.food).toMatchObject({ food_name_vi: 'Món mới' });
    expect(sub.status).toBe(SubmissionStatus.APPROVED);
  });

  it('approve 409 khi tên đã có trong catalog, reject đổi trạng thái', async () => {
    mockSubmissionRepo.findOne.mockResolvedValue({
      id: 's1',
      food_name_vi: 'Phở bò',
      status: SubmissionStatus.PENDING,
    });
    mockFoodRepo.findOne.mockResolvedValue({ id: 'f1' });
    await expect(service.approve('admin1', 's1')).rejects.toThrow();

    const sub2 = { id: 's2', status: SubmissionStatus.PENDING };
    mockSubmissionRepo.findOne.mockResolvedValue(sub2);
    mockSubmissionRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));
    const res = await service.reject('admin1', 's2');
    expect(sub2.status).toBe(SubmissionStatus.REJECTED);
    expect(res).toHaveProperty('message');
  });

  it('approve/reject 404 khi đã xử lý', async () => {
    mockSubmissionRepo.findOne.mockResolvedValue({
      id: 's9',
      status: SubmissionStatus.APPROVED,
    });
    await expect(service.approve('admin1', 's9')).rejects.toThrow();
    await expect(service.reject('admin1', 's9')).rejects.toThrow();
  });
});
