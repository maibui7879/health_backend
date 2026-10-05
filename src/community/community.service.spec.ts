import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { localizationMockProvider } from '../i18n/localization.mock';
import { insightsMock, insightsMockProvider } from '../insights/insights.mock';
import { Meal } from '../nutrition/entities/meal.entity';
import { NutritionPlan } from '../nutrition/entities/nutrition-plan.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Workout } from '../workout/entities/workout.entity';
import { CommunityService } from './community.service';
import { CommunityComment } from './entities/comment.entity';
import { AuthorScore } from './entities/author-score.entity';
import { PostView } from './entities/post-view.entity';
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
    find: jest.fn(),
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
  const mockViewRepo = {
    find: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(),
    create: jest.fn((v: Record<string, unknown>) => v),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
  };
  const mockAuthorScoreRepo = {
    find: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(),
    create: jest.fn((v: Record<string, unknown>) => v),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
  };
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
        { provide: getRepositoryToken(PostView), useValue: mockViewRepo },
        {
          provide: getRepositoryToken(AuthorScore),
          useValue: mockAuthorScoreRepo,
        },
        insightsMockProvider,
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

  describe('ranking ngầm (7F)', () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    const feedPost = (over: Record<string, unknown> = {}) => ({
      id: 'p1',
      user_id: 'u1',
      content: 'hello world',
      image_url: null,
      linked_type: null,
      linked_id: null,
      linked_snapshot: null,
      is_hidden: false,
      like_count: 0,
      comment_count: 0,
      report_count: 0,
      created_at: now,
      updated_at: now,
      ...over,
    });

    beforeEach(() => {
      insightsMock.getProfile.mockResolvedValue({
        liked_tags: {},
        disliked_tags: {},
        workout_prefs: {},
        interactions: 0,
        weight: 0,
        topLiked: [],
        topDisliked: [],
        topWorkouts: [],
      });
      mockReactionRepo.find.mockResolvedValue([]);
      mockViewRepo.find.mockResolvedValue([]);
      mockAuthorScoreRepo.find.mockResolvedValue([]);
    });

    it('affinity đẩy bài của author từng tương tác lên đầu', async () => {
      mockPostRepo.find.mockResolvedValue([
        feedPost({ id: 'pA', user_id: 'uA' }),
        feedPost({ id: 'pB', user_id: 'uB' }),
      ]);
      mockAuthorScoreRepo.find.mockResolvedValue([
        { author_id: 'uB', score: 5 },
      ]);

      const res = await service.feed('viewer', {});
      expect(res.posts.map((p) => p.id)).toEqual(['pB', 'pA']);
    });

    it('lướt qua 3 lần không tương tác bị phạt skip', async () => {
      mockPostRepo.find.mockResolvedValue([
        feedPost({ id: 'p1', user_id: 'u1' }),
        feedPost({ id: 'p2', user_id: 'u1' }),
      ]);
      mockViewRepo.find.mockResolvedValue([{ post_id: 'p1', impressions: 3 }]);

      const res = await service.feed('viewer', {});
      expect(res.posts.map((p) => p.id)).toEqual(['p2', 'p1']);
    });

    it('author từng bị report (score −2) bị mute ngầm khỏi feed', async () => {
      mockPostRepo.find.mockResolvedValue([
        feedPost({ id: 'p1', user_id: 'u9' }),
        feedPost({ id: 'p2', user_id: 'u1' }),
      ]);
      mockAuthorScoreRepo.find.mockResolvedValue([
        { author_id: 'u9', score: -2 },
      ]);

      const res = await service.feed('viewer', {});
      expect(res.posts.map((p) => p.id)).toEqual(['p2']);
      expect(res.total).toBe(1);
    });

    it('exploration: ô thứ 10 nhường cho bài chưa từng thấy', async () => {
      const fresh = Array.from({ length: 10 }, (_, i) =>
        feedPost({ id: `f${i}`, user_id: 'u1' }),
      );
      const oldPost = feedPost({ id: 'old', user_id: 'u2', created_at: old });
      mockPostRepo.find.mockResolvedValue([...fresh, oldPost]);
      mockViewRepo.find.mockResolvedValue(
        fresh.map((f) => ({ post_id: f.id, impressions: 1 })),
      );

      const res = await service.feed('viewer', { limit: 11 });
      const ids = res.posts.map((p) => p.id);
      expect(ids).toHaveLength(11);
      expect(ids[9]).toBe('old');
    });

    it('recordViews tạo mới / tăng impressions / bỏ qua bài ẩn', async () => {
      mockPostRepo.findOne
        .mockResolvedValueOnce(feedPost({ id: 'p1' }))
        .mockResolvedValueOnce(feedPost({ id: 'p2' }))
        .mockResolvedValueOnce(feedPost({ id: 'pX', is_hidden: true }));
      mockViewRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ post_id: 'p2', impressions: 2 });

      const res = await service.recordViews('viewer', ['p1', 'p1', 'p2', 'pX']);
      expect(res).toEqual({ recorded: 2 });
      expect(mockViewRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ post_id: 'p2', impressions: 3 }),
      );
    });

    it('like mới cộng affinity author +1', async () => {
      mockPostRepo.findOne.mockResolvedValue(post({ user_id: 'u1' }));
      mockReactionRepo.findOne.mockResolvedValue(null);
      mockAuthorScoreRepo.findOne.mockResolvedValue(null);

      await service.like('u2', 'p1', {});
      expect(mockAuthorScoreRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ author_id: 'u1', score: 1 }),
      );
    });
  });
});
