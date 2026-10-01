import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
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
import { Reaction, ReactionType } from './entities/reaction.entity';
import { Report } from './entities/report.entity';

// Đủ 3 report từ 3 user khác nhau → tự ẩn khỏi feed chờ xem lại.
const AUTO_HIDE_REPORTS = 3;

export type AuthorBrief = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(CommunityComment)
    private readonly commentRepo: Repository<CommunityComment>,
    @InjectRepository(Reaction)
    private readonly reactionRepo: Repository<Reaction>,
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(NutritionPlan)
    private readonly planRepo: Repository<NutritionPlan>,
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(Meal)
    private readonly mealRepo: Repository<Meal>,
    private readonly i18n: LocalizationService,
  ) {}

  // ---- Bài đăng ----

  async feed(viewerId: string, query: FeedQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [posts, total] = await this.postRepo.findAndCount({
      where: { is_hidden: false },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });
    return {
      posts: await this.withAuthorsAndLikes(posts, viewerId),
      total,
      limit,
      offset,
    };
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
    if (post.user_id === userId) {
      throw new BadRequestException(this.i18n.t('community.reportSelf'));
    }
    const dup = await this.reportRepo.findOne({
      where: { post_id: post.id, reporter_id: userId },
    });
    if (dup) {
      throw new ConflictException(this.i18n.t('community.reportExists'));
    }
    await this.reportRepo.save(
      this.reportRepo.create({
        post_id: post.id,
        reporter_id: userId,
        reason: dto.reason.trim(),
      }),
    );
    await this.postRepo
      .createQueryBuilder()
      .update()
      .set({ report_count: () => 'report_count + 1' })
      .where('id = :id', { id: post.id })
      .execute();
    const refreshed = await this.postRepo.findOne({
      where: { id: post.id },
    });
    if (
      refreshed &&
      !refreshed.is_hidden &&
      refreshed.report_count >= AUTO_HIDE_REPORTS
    ) {
      refreshed.is_hidden = true;
      await this.postRepo.save(refreshed);
    }
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

  private async withAuthorsAndLikes(posts: Post[], viewerId: string) {
    if (posts.length === 0) return [];
    const authors = await this.authorMap(posts.map((p) => p.user_id));
    const liked = await this.reactionRepo.find({
      where: { post_id: In(posts.map((p) => p.id)), user_id: viewerId },
    });
    const likedSet = new Set(liked.map((r) => r.post_id));
    return posts.map((p) => ({
      ...p,
      author: authors.get(p.user_id) ?? null,
      viewer_has_liked: likedSet.has(p.id),
    }));
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
