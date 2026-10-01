import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { localizationMockProvider } from '../i18n/localization.mock';
import { Meal } from '../nutrition/entities/meal.entity';
import { NutritionPlan } from '../nutrition/entities/nutrition-plan.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Workout } from '../workout/entities/workout.entity';
import { CommunityService } from './community.service';
import { CommunityComment } from './entities/comment.entity';
import { LinkedType } from './entities/post.entity';
import { Post } from './entities/post.entity';
import { Reaction } from './entities/reaction.entity';
import { Report } from './entities/report.entity';

describe('CommunityService', () => {
  let service: CommunityService;

  const qb = () => {
    const chain: Record<string, jest.Mock> = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      execute: jest.fn(() => Promise.resolve({})),
    };
    chain.update.mockReturnValue(chain);
    chain.set.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    return chain;
  };

  const mockPostRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockCommentRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockReactionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockReportRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockProfileRepo = { find: jest.fn(() => Promise.resolve([])) };
  const mockPlanRepo = { findOne: jest.fn() };
  const mockWorkoutRepo = { findOne: jest.fn() };
  const mockMealRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        localizationMockProvider,
        { provide: getRepositoryToken(Post), useValue: mockPostRepo },
        {
          provide: getRepositoryToken(CommunityComment),
          useValue: mockCommentRepo,
        },
        { provide: getRepositoryToken(Reaction), useValue: mockReactionRepo },
        { provide: getRepositoryToken(Report), useValue: mockReportRepo },
        {
          provide: getRepositoryToken(UserProfile),
          useValue: mockProfileRepo,
        },
        {
          provide: getRepositoryToken(NutritionPlan),
          useValue: mockPlanRepo,
        },
        { provide: getRepositoryToken(Workout), useValue: mockWorkoutRepo },
        { provide: getRepositoryToken(Meal), useValue: mockMealRepo },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    mockPostRepo.createQueryBuilder.mockImplementation(qb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const post = (over: Partial<Post> = {}) =>
    ({
      id: 'p1',
      user_id: 'u1',
      content: 'hello',
      image_url: null,
      linked_type: null,
      linked_id: null,
      linked_snapshot: null,
      is_hidden: false,
      like_count: 0,
      comment_count: 0,
      report_count: 0,
      ...over,
    }) as Post;

  describe('posts', () => {
    it('create without link saves null snapshot', async () => {
      mockPostRepo.create.mockImplementation((v: Record<string, unknown>) => v);
      mockPostRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 'p1', ...v }),
      );
      mockReactionRepo.find.mockResolvedValue([]);

      const res = (await service.create('u1', {
        content: '  hello  ',
      })) as unknown as Post;
      expect(mockPostRepo.save).toHaveBeenCalled();
      expect(res.content).toBe('hello');
      expect(res.linked_snapshot).toBeNull();
    });

    it('create with only linked_type throws BadRequest', async () => {
      await expect(
        service.create('u1', {
          content: 'x',
          linked_type: LinkedType.WORKOUT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('create with others workout links snapshot', async () => {
      mockWorkoutRepo.findOne.mockResolvedValue({
        id: 'w1',
        activity_type: 'RUNNING',
        duration_minutes: 30,
        burned_kcal: 250,
        date: '2026-10-01',
      });
      mockPostRepo.create.mockImplementation((v: Record<string, unknown>) => v);
      mockPostRepo.save.mockImplementation((v: Record<string, unknown>) =>
        Promise.resolve({ id: 'p1', ...v }),
      );
      mockReactionRepo.find.mockResolvedValue([]);

      const res = (await service.create('u1', {
        content: 'run!',
        linked_type: LinkedType.WORKOUT,
        linked_id: 'w1',
      })) as unknown as Post;
      expect(res.linked_snapshot).toMatchObject({
        kind: 'WORKOUT',
        activity_type: 'RUNNING',
      });
    });

    it('update by non-owner throws Forbidden', async () => {
      mockPostRepo.findOne.mockResolvedValue(post());
      await expect(
        service.update('u2', 'p1', { content: 'hack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hidden post is NotFound for outsiders but visible to owner', async () => {
      mockPostRepo.findOne.mockResolvedValue(post({ is_hidden: true }));
      mockReactionRepo.find.mockResolvedValue([]);
      await expect(service.getOne('u2', 'p1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.getOne('u1', 'p1')).resolves.toBeDefined();
    });
  });

  describe('reactions', () => {
    it('like is idempotent when already liked', async () => {
      mockPostRepo.findOne.mockResolvedValue(post({ like_count: 5 }));
      mockReactionRepo.findOne.mockResolvedValue({ id: 'r1' });

      const res = await service.like('u2', 'p1', {});
      expect(res).toEqual({ liked: true, like_count: 5 });
      expect(mockReactionRepo.save).not.toHaveBeenCalled();
    });

    it('unlike without existing reaction stays unliked', async () => {
      mockPostRepo.findOne.mockResolvedValue(post());
      mockReactionRepo.findOne.mockResolvedValue(null);

      const res = await service.unlike('u2', 'p1');
      expect(res).toEqual({ liked: false, like_count: 0 });
      expect(mockReactionRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('comments', () => {
    it('update by non-owner throws Forbidden', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        id: 'c1',
        post_id: 'p1',
        user_id: 'u1',
      });
      await expect(
        service.updateComment('u2', 'c1', { content: 'hack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('post owner can delete comments on own post', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        id: 'c1',
        post_id: 'p1',
        user_id: 'u2',
      });
      mockPostRepo.findOne.mockResolvedValue(post());
      mockCommentRepo.remove.mockResolvedValue({});

      const res = await service.deleteComment('u1', 'c1');
      expect(res.message).toBe('community.commentDeleted');
    });

    it('stranger cannot delete comments', async () => {
      mockCommentRepo.findOne.mockResolvedValue({
        id: 'c1',
        post_id: 'p1',
        user_id: 'u2',
      });
      mockPostRepo.findOne.mockResolvedValue(post());
      await expect(service.deleteComment('u3', 'c1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('reports', () => {
    it('self-report throws BadRequest', async () => {
      mockPostRepo.findOne.mockResolvedValue(post());
      await expect(
        service.report('u1', 'p1', { reason: 'spam' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('duplicate report throws Conflict', async () => {
      mockPostRepo.findOne.mockResolvedValue(post({ user_id: 'u1' }));
      mockReportRepo.findOne.mockResolvedValue({ id: 'rep1' });
      await expect(
        service.report('u2', 'p1', { reason: 'spam' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('third report auto-hides the post', async () => {
      mockPostRepo.findOne
        .mockResolvedValueOnce(post({ user_id: 'u1' }))
        .mockResolvedValueOnce(post({ user_id: 'u1', report_count: 3 }));
      mockReportRepo.findOne.mockResolvedValue(null);
      mockReportRepo.save.mockImplementation((v: unknown) =>
        Promise.resolve(v),
      );

      const res = await service.report('u2', 'p1', { reason: 'spam' });
      expect(res.message).toBe('community.reportCreated');
      expect(mockPostRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ is_hidden: true }),
      );
    });
  });
});
