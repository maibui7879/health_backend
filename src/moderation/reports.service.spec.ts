import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityComment } from '../community/entities/comment.entity';
import { Post } from '../community/entities/post.entity';
import { localizationMockProvider } from '../i18n/localization.mock';
import { Food } from '../nutrition/entities/food.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ExerciseTemplate } from '../workout/entities/exercise-template.entity';
import { Workout } from '../workout/entities/workout.entity';

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
  })),
}));
import {
  ReportCase,
  ReportCategory,
  ReportDecision,
  ReportStatus,
  ReportTarget,
} from './entities/report-case.entity';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const mockReportRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
  };
  const mockPostRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockCommentRepo = { findOne: jest.fn(), remove: jest.fn() };
  const mockUserRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockWorkoutRepo = { findOne: jest.fn() };
  const mockTemplateRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockFoodRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        localizationMockProvider,
        { provide: getRepositoryToken(ReportCase), useValue: mockReportRepo },
        { provide: getRepositoryToken(Post), useValue: mockPostRepo },
        { provide: getRepositoryToken(CommunityComment), useValue: mockCommentRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Workout), useValue: mockWorkoutRepo },
        { provide: getRepositoryToken(ExerciseTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(Food), useValue: mockFoodRepo },
        {
          provide: NotificationsService,
          useValue: { notify: jest.fn(() => Promise.resolve(null)) },
        },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const dto = (over = {}) => ({
    target_type: ReportTarget.COMMENT,
    target_id: 'c1',
    category: ReportCategory.HARASSMENT,
    ...over,
  });

  it('tố cáo comment hợp lệ', async () => {
    mockCommentRepo.findOne.mockResolvedValue({ id: 'c1', user_id: 'u2' });
    mockReportRepo.findOne.mockResolvedValue(null);
    mockReportRepo.create.mockImplementation((v: unknown) => v);
    mockReportRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

    const res = await service.fileReport('u1', dto());
    expect(res.report).toMatchObject({ target_type: 'COMMENT' });
  });

  it('tự tố cáo chính mình 400', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u1' });
    await expect(
      service.fileReport('u1', {
        target_type: ReportTarget.USER,
        target_id: 'u1',
        category: ReportCategory.SPAM,
      }),
    ).rejects.toThrow();
  });

  it('trùng report 409', async () => {
    mockCommentRepo.findOne.mockResolvedValue({ id: 'c1', user_id: 'u2' });
    mockReportRepo.findOne.mockResolvedValue({ id: 'r1' });
    await expect(service.fileReport('u1', dto())).rejects.toThrow();
  });

  it('admin BAN_USER đổi status + UNBAN mở lại', async () => {
    const user = { id: 'bad1', status: 'ACTIVE' };
    const report = { id: 'r1', target_type: ReportTarget.USER, target_id: 'bad1', status: ReportStatus.PENDING };
    mockReportRepo.findOne.mockResolvedValue(report);
    mockUserRepo.findOne.mockResolvedValue(user);
    mockReportRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));
    mockUserRepo.save.mockImplementation((v: unknown) => Promise.resolve(v));

    const banned = await service.review('admin', 'r1', { decision: ReportDecision.BAN_USER });
    expect(user.status).toBe('BANNED');
    expect(banned.status).toBe(ReportStatus.ACTIONED);

    report.status = ReportStatus.PENDING;
    const unbanned = await service.review('admin', 'r1', { decision: ReportDecision.UNBAN_USER });
    expect(user.status).toBe('ACTIVE');
    expect(unbanned.action_taken).toBe(ReportDecision.UNBAN_USER);
  });

  it('action sai loại target 400 (HIDE_POST cho USER)', async () => {
    mockReportRepo.findOne.mockResolvedValue({
      id: 'r2',
      target_type: ReportTarget.USER,
      target_id: 'u9',
      status: ReportStatus.PENDING,
    });
    await expect(
      service.review('admin', 'r2', { decision: ReportDecision.HIDE_POST }),
    ).rejects.toThrow();
  });

  it('review report đã xử lý 404', async () => {
    mockReportRepo.findOne.mockResolvedValue({
      id: 'r3',
      status: ReportStatus.DISMISSED,
    });
    await expect(
      service.review('admin', 'r3', { decision: ReportDecision.DISMISS }),
    ).rejects.toThrow();
  });
});
