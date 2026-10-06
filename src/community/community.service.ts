import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { InsightsService } from '../insights/insights.service';
import { tokenizeTaste } from '../insights/taste-tokenizer';
import {
  ReportCategory,
  ReportTarget,
} from '../moderation/entities/report-case.entity';
import { ReportsService } from '../moderation/reports.service';
import { Meal } from '../nutrition/entities/meal.entity';
import { NutritionPlan } from '../nutrition/entities/nutrition-plan.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Workout } from '../workout/entities/workout.entity';
import {
  CreateCommentDto,
  CreatePostDto,
  FeedQueryDto,
  ReactDto,
  ReportPostDto,
  UpdateCommentDto,
  UpdatePostDto,
} from './dto/community.dto';
import { CommunityComment } from './entities/comment.entity';
import { LinkedType, Post } from './entities/post.entity';
import { AuthorScore } from './entities/author-score.entity';
import { PostView } from './entities/post-view.entity';
import { Reaction, ReactionType } from './entities/reaction.entity';

// Đủ 3 report từ 3 user khác nhau → tự ẩn khỏi feed chờ xem lại.
const AUTO_HIDE_REPORTS = 3;

// Ranking feed ngầm (Phase 7F) — 0 token, tính trong SQL/TS thuần.
const FEED_CANDIDATES = 200;
const W_RECENCY = 0.35;
const W_POPULARITY = 0.25;
const W_AFFINITY = 0.3;
const W_CONTENT = 0.1;
const SKIP_AFTER_IMPRESSIONS = 3;
const SKIP_PENALTY = 0.5;
// Điểm author <= ngưỡng này coi như mute ngầm (1 report = −2).
const REPORT_HIDE_AT = -2;
const EXPLORATION_EVERY = 10;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type AuthorBrief = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(CommunityComment)
    private readonly commentRepo: Repository<CommunityComment>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(NutritionPlan)
    private readonly planRepo: Repository<NutritionPlan>,
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(Meal)
    private readonly mealRepo: Repository<Meal>,
    @InjectRepository(PostView)
    private readonly viewRepo: Repository<PostView>,
    @InjectRepository(AuthorScore)
    private readonly authorScoreRepo: Repository<AuthorScore>,
    private readonly i18n: LocalizationService,
    private readonly insights: InsightsService,
    private readonly reports: ReportsService,
  ) {}

  // ---- Bài đăng ----

  async feed(viewerId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const candidates = await this.postRepo.find({
      where: { is_hidden: false },
      order: { created_at: 'DESC' },
      take: FEED_CANDIDATES,
    });
    const ranked = await this.rankFeed(viewerId, candidates);
    const page = ranked.slice(offset, offset + limit);
    return {
      posts: await this.withAuthorsAndLikes(page, viewerId),
      total: ranked.length,
      limit,
      offset,
    };
  }

  // Ghi batch impression "thấy thật" từ FE (riêng tư, không expose).
  async recordViews(userId: string, postIds: string[]) {
    const unique = [...new Set(postIds)].slice(0, 50);
    let recorded = 0;
    for (const postId of unique) {
      try {
        const post = await this.postRepo.findOne({ where: { id: postId } });
        if (!post || (post.is_hidden && post.user_id !== userId)) continue;
        const existing = await this.viewRepo.findOne({
          where: { user_id: userId, post_id: postId },
        });
        if (existing) {
          existing.impressions += 1;
          await this.viewRepo.save(existing);
        } else {
          await this.viewRepo.save(
            this.viewRepo.create({
              user_id: userId,
              post_id: postId,
              impressions: 1,
            }),
          );
        }
        recorded += 1;
      } catch (error) {
        this.logger.warn(`Ghi view thất bại (bỏ qua): ${String(error)}`);
      }
    }
    return { recorded };
  }

  async mine(userId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [posts, total] = await this.postRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return {
      posts: await this.withAuthorsAndLikes(posts, userId),
      total,
      limit,
      offset,
    };
  }

  async getOne(viewerId: string, postId: string) {
    const post = await this.getVisible(viewerId, postId);
    const [enriched] = await this.withAuthorsAndLikes([post], viewerId);
    return enriched;
  }

  async create(userId: string, dto: CreatePostDto) {
    const snapshot = await this.buildLinkedSnapshot(userId, dto);
    const post = this.postRepo.create({
      user_id: userId,
      content: dto.content.trim(),
      image_url: dto.image_url?.trim() || null,
      linked_type: dto.linked_type ?? null,
      linked_id: dto.linked_id ?? null,
      linked_snapshot: snapshot,
    });
    const saved = await this.postRepo.save(post);
    const [enriched] = await this.withAuthorsAndLikes([saved], userId);
    return enriched;
  }

  async update(userId: string, postId: string, dto: UpdatePostDto) {
    const post = await this.getOwned(userId, postId);
    if (dto.content !== undefined) post.content = dto.content.trim();
    if (dto.image_url !== undefined)
      post.image_url = dto.image_url?.trim() || null;
    const saved = await this.postRepo.save(post);
    const [enriched] = await this.withAuthorsAndLikes([saved], userId);
    return enriched;
  }

  async remove(userId: string, postId: string) {
    const post = await this.getOwned(userId, postId);
    await this.postRepo.remove(post);
    return { message: this.i18n.t('community.postDeleted') };
  }

  // ---- Bình luận (sửa: chỉ chủ comment; xóa: chủ comment hoặc chủ bài) ----

  async listComments(viewerId: string, postId: string, query: FeedQueryDto) {
    await this.getVisible(viewerId, postId);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const [comments, total] = await this.commentRepo.findAndCount({
      where: { post_id: postId },
      order: { created_at: 'ASC' },
      take: Math.min(limit, 50),
      skip: offset,
    });
    const authors = await this.authorMap(comments.map((c) => c.user_id));
    return {
      comments: comments.map((c) => ({
        ...c,
        author: authors.get(c.user_id) ?? null,
      })),
      total,
      limit: Math.min(limit, 50),
      offset,
    };
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.getVisible(userId, postId);
    const comment = await this.commentRepo.save(
      this.commentRepo.create({
        post_id: post.id,
        user_id: userId,
        content: dto.content.trim(),
      }),
    );
    await this.postRepo
      .createQueryBuilder()
      .update()
      .set({ comment_count: () => 'comment_count + 1' })
      .where('id = :id', { id: post.id })
      .execute();
    // Hook affinity 7F (fire-and-forget).
    void this.bumpAuthor(userId, post.user_id, 1);
    const authors = await this.authorMap([userId]);
    return { ...comment, author: authors.get(userId) ?? null };
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('community.commentNotFound'));
    }
    if (comment.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('community.commentForbidden'));
    }
    comment.content = dto.content.trim();
    const saved = await this.commentRepo.save(comment);
    const authors = await this.authorMap([userId]);
    return { ...saved, author: authors.get(userId) ?? null };
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('community.commentNotFound'));
    }
    const post = await this.postRepo.findOne({
      where: { id: comment.post_id },
    });
    const isCommentOwner = comment.user_id === userId;
    const isPostOwner = post?.user_id === userId;
    if (!isCommentOwner && !isPostOwner) {
      throw new ForbiddenException(this.i18n.t('community.commentForbidden'));
    }
    await this.commentRepo.remove(comment);
    await this.postRepo
      .createQueryBuilder()
      .update()
      .set({ comment_count: () => 'GREATEST(comment_count - 1, 0)' })
      .where('id = :id', { id: comment.post_id })
      .execute();
    return { message: this.i18n.t('community.commentDeleted') };
  }

  // ---- Tương tác (like / unlike, idempotent) ----

  async like(userId: string, postId: string, dto: ReactDto) {
    const post = await this.getVisible(userId, postId);
    const existing = await this.reactionRepo.findOne({
      where: { post_id: post.id, user_id: userId },
    });
    if (!existing) {
      await this.reactionRepo.save(
        this.reactionRepo.create({
          post_id: post.id,
          user_id: userId,
          type: dto.type ?? ReactionType.LIKE,
        }),
      );
      await this.postRepo
        .createQueryBuilder()
        .update()
        .set({ like_count: () => 'like_count + 1' })
        .where('id = :id', { id: post.id })
        .execute();
      // Hook affinity 7F + taste 7B (chỉ lần like mới, fire-and-forget).
      void this.bumpAuthor(userId, post.user_id, 1);
      void this.insights.recordCommunityLike(userId, post.content);
    }
    return {
      liked: true,
      like_count: (await this.getVisible(userId, post.id)).like_count,
    };
  }

  async unlike(userId: string, postId: string) {
    const post = await this.getVisible(userId, postId);
    const existing = await this.reactionRepo.findOne({
      where: { post_id: post.id, user_id: userId },
    });
    if (existing) {
      await this.reactionRepo.remove(existing);
      await this.postRepo
        .createQueryBuilder()
        .update()
        .set({ like_count: () => 'GREATEST(like_count - 1, 0)' })
        .where('id = :id', { id: post.id })
        .execute();
    }
    return {
      liked: false,
      like_count: (await this.getVisible(userId, post.id)).like_count,
    };
  }

  // ---- Kiểm duyệt cơ bản (report / tự ẩn khi đủ 3 report) ----

  async report(userId: string, postId: string, dto: ReportPostDto) {
    const post = await this.getVisible(userId, postId);
    // Ghi vào bảng reports chung (giữ message + auto-hide + affinity cũ).
    try {
      await this.reports.fileReport(userId, {
        target_type: ReportTarget.POST,
        target_id: post.id,
        category: ReportCategory.OTHER,
        details: dto.reason.trim(),
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(this.i18n.t('community.reportSelf'));
      }
      if (error instanceof ConflictException) {
        throw new ConflictException(this.i18n.t('community.reportExists'));
      }
      throw error;
    }
    await this.postRepo
      .createQueryBuilder()
      .update()
      .set({ report_count: () => 'report_count + 1' })
      .where('id = :id', { id: post.id })
      .execute();
    const count = await this.reports.activeCount(
      ReportTarget.POST,
      post.id,
    );
    const refreshed = await this.postRepo.findOne({
      where: { id: post.id },
    });
    if (refreshed && !refreshed.is_hidden && count >= AUTO_HIDE_REPORTS) {
      refreshed.is_hidden = true;
      await this.postRepo.save(refreshed);
    }
    // Hook affinity 7F: report = −2 → mute ngầm author này (fire-and-forget).
    void this.bumpAuthor(userId, post.user_id, -2);
    return { message: this.i18n.t('community.reportCreated') };
  }

  // ---- Helpers ----

  private async getVisible(viewerId: string, postId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    // Bài bị ẩn coi như không tồn tại với người ngoài (tránh lộ nội dung).
    if (!post || (post.is_hidden && post.user_id !== viewerId)) {
      throw new NotFoundException(this.i18n.t('community.postNotFound'));
    }
    return post;
  }

  private async getOwned(userId: string, postId: string) {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(this.i18n.t('community.postNotFound'));
    }
    if (post.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('community.postForbidden'));
    }
    return post;
  }

  private async authorMap(
    userIds: string[],
  ): Promise<Map<string, AuthorBrief>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const profiles = await this.profileRepo.find({
      where: { user_id: In(unique) },
    });
    const map = new Map<string, AuthorBrief>();
    for (const id of unique) {
      const p = profiles.find((row) => row.user_id === id);
      map.set(id, {
        user_id: id,
        full_name: p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      });
    }
    return map;
  }

  private async withAuthorsAndLikes(
    posts: Post[],
    viewerId: string,
    likedSet?: Set<string>,
  ) {
    if (posts.length === 0) return [];
    const authors = await this.authorMap(posts.map((p) => p.user_id));
    const liked =
      likedSet ??
      new Set(
        (
          await this.reactionRepo.find({
            where: { post_id: In(posts.map((p) => p.id)), user_id: viewerId },
          })
        ).map((r) => r.post_id),
      );
    return posts.map((p) => ({
      ...p,
      author: authors.get(p.user_id) ?? null,
      viewer_has_liked: liked.has(p.id),
    }));
  }

  // Ranking feed ngầm (7F): recency + popularity + affinity + content_match
  // − skip_penalty, kèm exploration chống filter bubble. 0 token.
  private async rankFeed(viewerId: string, posts: Post[]): Promise<Post[]> {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.id);
    const authorIds = [...new Set(posts.map((p) => p.user_id))];
    const [views, scores, taste, liked] = await Promise.all([
      this.viewRepo.find({ where: { user_id: viewerId, post_id: In(ids) } }),
      this.authorScoreRepo.find({
        where: { user_id: viewerId, author_id: In(authorIds) },
      }),
      this.insights.getProfile(viewerId).catch(() => null),
      this.reactionRepo.find({
        where: { post_id: In(ids), user_id: viewerId },
      }),
    ]);
    const viewMap = new Map(views.map((v) => [v.post_id, v.impressions]));
    const scoreMap = new Map(scores.map((s) => [s.author_id, s.score]));
    const likedSet = new Set(liked.map((r) => r.post_id));
    const likedTags = taste?.liked_tags ?? {};
    const tasteWeight = taste?.weight ?? 0;

    // Lọc ngầm: author từng bị report (score <= −2) coi như mute.
    const visible = posts.filter(
      (p) => (scoreMap.get(p.user_id) ?? 0) > REPORT_HIDE_AT,
    );
    const popRaw = visible.map((p) =>
      Math.log(1 + p.like_count + 2 * p.comment_count),
    );
    const maxPop = Math.max(0, ...popRaw);
    const contentRaw = new Map(
      visible.map((p) => [
        p.id,
        tokenizeTaste(p.content ?? '').reduce(
          (s, t) => s + (likedTags[t] ?? 0),
          0,
        ),
      ]),
    );
    const maxContent = Math.max(0, ...contentRaw.values());
    const now = Date.now();

    const scored = visible.map((p, i) => {
      const created = new Date(p.created_at).getTime();
      const ageHours = Number.isFinite(created)
        ? Math.max(0, (now - created) / 3600000)
        : 0;
      const recency = Math.exp(-ageHours / 48);
      const popularity = maxPop > 0 ? (popRaw[i] ?? 0) / maxPop : 0;
      const affRaw = Math.min(5, Math.max(-5, scoreMap.get(p.user_id) ?? 0));
      const affinity = (affRaw + 5) / 10;
      const content =
        maxContent > 0 ? (contentRaw.get(p.id) ?? 0) / maxContent : 0;
      const impressions = viewMap.get(p.id) ?? 0;
      const skip =
        impressions >= SKIP_AFTER_IMPRESSIONS && !likedSet.has(p.id)
          ? SKIP_PENALTY
          : 0;
      return {
        post: p,
        score: round2(
          W_RECENCY * recency +
            W_POPULARITY * popularity +
            W_AFFINITY * affinity +
            W_CONTENT * content * tasteWeight -
            skip,
        ),
      };
    });
    scored.sort((a, b) => b.score - a.score);

    // Exploration: mỗi ô thứ 10 nhường cho bài chưa từng thấy.
    const unseenQueue = scored.filter(
      (s) => (viewMap.get(s.post.id) ?? 0) === 0,
    );
    const placed = new Set<string>();
    const final: typeof scored = [];
    let ui = 0;
    for (const s of scored) {
      if (placed.has(s.post.id)) continue;
      if ((final.length + 1) % EXPLORATION_EVERY === 0) {
        while (
          ui < unseenQueue.length &&
          placed.has(unseenQueue[ui]?.post.id ?? '')
        ) {
          ui++;
        }
        const u = unseenQueue[ui++];
        if (u && !placed.has(u.post.id)) {
          placed.add(u.post.id);
          final.push(u);
        }
      }
      if (placed.has(s.post.id)) continue;
      placed.add(s.post.id);
      final.push(s);
    }
    return final.map((f) => f.post);
  }

  // Điểm quan hệ ngầm user→author (like/comment +1, report −2, kẹp −5..10).
  // Tự tương tác không tính. Nuốt lỗi để không hỏng luồng chính.
  private async bumpAuthor(
    userId: string,
    authorId: string,
    delta: number,
  ): Promise<void> {
    if (userId === authorId) return;
    try {
      let row = await this.authorScoreRepo.findOne({
        where: { user_id: userId, author_id: authorId },
      });
      if (!row) {
        row = this.authorScoreRepo.create({
          user_id: userId,
          author_id: authorId,
          score: 0,
          interactions: 0,
        });
      }
      row.score = round2(Math.min(10, Math.max(-5, row.score + delta)));
      row.interactions += 1;
      await this.authorScoreRepo.save(row);
    } catch (error) {
      this.logger.warn(`Cộng điểm author thất bại (bỏ qua): ${String(error)}`);
    }
  }

  // Snapshot nội dung gắn kèm để feed không phụ thuộc quyền xem private.
  private async buildLinkedSnapshot(
    userId: string,
    dto: CreatePostDto,
  ): Promise<Record<string, unknown> | null> {
    const hasType = dto.linked_type !== undefined;
    const hasId = dto.linked_id !== undefined;
    if (!hasType && !hasId) return null;
    if (!hasType || !hasId) {
      throw new BadRequestException(this.i18n.t('community.linkedIncomplete'));
    }
    if (dto.linked_type === LinkedType.NUTRITION_PLAN) {
      const plan = await this.planRepo.findOne({
        where: { id: dto.linked_id, user_id: userId },
      });
      if (!plan) {
        throw new NotFoundException(this.i18n.t('community.linkedNotFound'));
      }
      return {
        kind: LinkedType.NUTRITION_PLAN,
        title: plan.title,
        date_from: plan.date_from,
        date_to: plan.date_to,
        status: plan.status,
        cover_emoji: plan.cover_emoji,
      };
    }
    if (dto.linked_type === LinkedType.WORKOUT) {
      const workout = await this.workoutRepo.findOne({
        where: { id: dto.linked_id, user_id: userId },
      });
      if (!workout) {
        throw new NotFoundException(this.i18n.t('community.linkedNotFound'));
      }
      return {
        kind: LinkedType.WORKOUT,
        activity_type: workout.activity_type,
        duration_minutes: workout.duration_minutes,
        burned_kcal: workout.burned_kcal,
        date: workout.date,
      };
    }
    const meal = await this.mealRepo.findOne({
      where: { id: dto.linked_id },
      relations: { daily_nutrition: true, items: true },
    });
    if (!meal || meal.daily_nutrition?.user_id !== userId) {
      throw new NotFoundException(this.i18n.t('community.linkedNotFound'));
    }
    return {
      kind: LinkedType.MEAL,
      meal_type: meal.meal_type,
      meal_kcal: meal.meal_kcal,
      is_safe: meal.is_safe,
      date: meal.daily_nutrition?.date ?? null,
      items_count: Array.isArray(meal.items) ? meal.items.length : 0,
    };
  }
}
