import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushService } from '../common/push/push.service';
import { PushService } from '../common/push/push.service';
import { localizationMockProvider } from '../i18n/localization.mock';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import {
  AppNotification,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
  })),
  isExpoPushToken: jest.fn(() => true),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  const mockNotificationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockUserRepo = { findOne: jest.fn(), update: jest.fn() };
  const mockSettingRepo = { findOne: jest.fn() };
  const mockPush = { isPushToken: jest.fn(() => false), sendMany: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(AppNotification),
          useValue: mockNotificationRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(UserSetting),
          useValue: mockSettingRepo,
        },
        { provide: PushService, useValue: mockPush },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('notify lưu in-app theo locale user, không push khi thiếu token', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u1', device_token: null });
    mockSettingRepo.findOne.mockResolvedValue({ locale: 'vi' });
    mockNotificationRepo.create.mockImplementation((v: unknown) => v);
    mockNotificationRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve({ id: 'n1', ...(v as object) }),
    );

    const res = await service.notify('u1', {
      type: NotificationType.GOAL_COMPLETED,
      title: { vi: 'Xong', en: 'Done' },
    });

    expect(mockNotificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Xong', is_read: false }),
    );
    expect(mockPush.sendMany).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: 'n1' });
  });

  it('notify null khi user không tồn tại', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    mockSettingRepo.findOne.mockResolvedValue(null);
    await expect(
      service.notify('ghost', {
        type: NotificationType.SYSTEM,
        title: { vi: 'x', en: 'x' },
      }),
    ).resolves.toBeNull();
    expect(mockNotificationRepo.save).not.toHaveBeenCalled();
  });

  it('unreadCount + markAllRead', async () => {
    const qb = { update: jest.fn(), set: jest.fn(), where: jest.fn(), execute: jest.fn(() => Promise.resolve({})) };
    qb.update.mockReturnValue(qb);
    qb.set.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);
    mockNotificationRepo.count.mockResolvedValue(3);
    await expect(service.markAllRead('u1')).resolves.toEqual({ unread: 3 });
  });
});
