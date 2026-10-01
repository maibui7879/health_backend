import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from '../common/push/push.service';
import { localizationMockProvider } from '../i18n/localization.mock';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import { Reminder, ReminderType } from './entities/reminder.entity';
import { RemindersService } from './reminders.service';

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
  })),
}));

describe('RemindersService', () => {
  let service: RemindersService;

  interface ChainableQuery {
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
    execute: jest.Mock;
  }
  const mockReminderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockUserRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockSettingRepo = { findOne: jest.fn() };
  const mockPushService = { isPushToken: jest.fn(), sendMany: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        localizationMockProvider,
        { provide: getRepositoryToken(Reminder), useValue: mockReminderRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserSetting), useValue: mockSettingRepo },
        { provide: PushService, useValue: mockPushService },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CRUD', () => {
    it('create defaults days to [] and enables', async () => {
      mockReminderRepo.create.mockImplementation(
        (v: Record<string, unknown>) => v,
      );
      mockReminderRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 'r1', ...v }),
      );

      const res = await service.create('u1', {
        type: ReminderType.WATER,
        time: '08:00',
      });

      expect(mockReminderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          days: [],
          enabled: true,
        }),
      );
      expect(res.reminder).toHaveProperty('id', 'r1');
    });

    it('getOwned throws NotFound for missing', async () => {
      mockReminderRepo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'nope', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('getOwned throws Forbidden for other user', async () => {
      mockReminderRepo.findOne.mockResolvedValue({
        id: 'r1',
        user_id: 'other',
      });
      await expect(service.remove('u1', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockReminderRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('sendDueReminders', () => {
    // Thứ 2 (day=1) 08:00 UTC.
    const monday8 = new Date(Date.UTC(2026, 8, 28, 8, 0, 0));

    function mockDue(rows: Partial<Reminder>[]): {
      qb: ChainableQuery;
      uqb: ChainableQuery;
    } {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      mockReminderRepo.createQueryBuilder.mockReturnValue(qb);
      const uqb: ChainableQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(uqb);
      return { qb, uqb };
    }

    it('sends due reminder and stamps last_sent_at', async () => {
      mockDue([
        {
          id: 'r1',
          user_id: 'u1',
          type: ReminderType.WATER,
          time: '08:00',
          days: [],
          title: null,
          body: null,
        },
      ]);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        device_token: 'ExponentPushToken[abc]',
      });
      mockSettingRepo.findOne.mockResolvedValue({
        locale: 'vi',
        remind_water: true,
        remind_meals: true,
      });
      mockPushService.isPushToken.mockReturnValue(true);
      mockPushService.sendMany.mockResolvedValue({
        sent: 1,
        invalidTokens: [],
      });

      const res = await service.sendDueReminders(monday8);

      expect(res.sent).toBe(1);
      expect(mockPushService.sendMany).toHaveBeenCalledWith([
        {
          to: 'ExponentPushToken[abc]',
          title: 'reminders.defaultWaterTitle',
          body: 'reminders.defaultWaterBody',
        },
      ]);
    });

    it('skips when day not in days', async () => {
      mockDue([
        {
          id: 'r1',
          user_id: 'u1',
          type: ReminderType.WATER,
          time: '08:00',
          days: [0],
          title: null,
          body: null,
        },
      ]);

      const res = await service.sendDueReminders(monday8);

      expect(res.sent).toBe(0);
      expect(mockPushService.sendMany).not.toHaveBeenCalled();
      expect(mockUserRepo.findOne).not.toHaveBeenCalled();
    });

    it('respects remind_water=false setting gate', async () => {
      mockDue([
        {
          id: 'r1',
          user_id: 'u1',
          type: ReminderType.WATER,
          time: '08:00',
          days: [],
          title: null,
          body: null,
        },
      ]);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        device_token: 'ExponentPushToken[abc]',
      });
      mockSettingRepo.findOne.mockResolvedValue({
        locale: 'vi',
        remind_water: false,
        remind_meals: true,
      });

      const res = await service.sendDueReminders(monday8);

      expect(res.sent).toBe(0);
      expect(mockPushService.sendMany).not.toHaveBeenCalled();
    });

    it('clears dead device tokens', async () => {
      const { uqb } = mockDue([
        {
          id: 'r1',
          user_id: 'u1',
          type: ReminderType.MEAL,
          time: '08:00',
          days: [],
          title: 'Eat',
          body: 'Now',
        },
      ]);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        device_token: 'ExponentPushToken[dead]',
      });
      mockSettingRepo.findOne.mockResolvedValue({
        locale: 'en',
        remind_water: true,
        remind_meals: true,
      });
      mockPushService.isPushToken.mockReturnValue(true);
      mockPushService.sendMany.mockResolvedValue({
        sent: 0,
        invalidTokens: ['ExponentPushToken[dead]'],
      });

      await service.sendDueReminders(monday8);

      expect(uqb.execute).toHaveBeenCalled();
    });
  });
});
