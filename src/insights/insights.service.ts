import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toSearchNorm } from '../nutrition/search-norm';
import { Food } from '../nutrition/entities/food.entity';
import {
  ACTIVITY_NORMS,
  foodNorms,
  mineMentions,
  type FoodNorm,
} from './chat-dictionary';
import { UserTasteProfile } from './entities/user-taste-profile.entity';
import { tokenizeTaste } from './taste-tokenizer';

// Hồ sơ gu ngầm của user — lớp tín hiệu chung cho gợi ý món/workout
// (Phase 7C/7D) và feed community (7F), không gọi AI, 0 token.
// Ghi incremental theo event; cron đêm decay; đọc qua getProfile().
// Mọi record* đều nuốt lỗi (taste không được làm hỏng luồng chính).

// Decay mỗi đêm: half-life 90 ngày → 0.5^(1/90).
const DAILY_DECAY = Math.pow(0.5, 1 / 90);
// Tỉa tag mờ hơn ngưỡng này.
const PRUNE_BELOW = 0.05;
// Cold start: profile <14 ngày hoặc <5 tín hiệu → weight 0 (chỉ explicit).
const MIN_AGE_DAYS = 14;
const MIN_INTERACTIONS = 5;
const FULL_WEIGHT_AT = 30;

export type RankedTag = { tag: string; score: number };
export type RankedWorkout = { activity: string; count: number };

export type TasteProfile = {
  liked_tags: Record<string, number>;
  disliked_tags: Record<string, number>;
  workout_prefs: Record<string, number>;
  interactions: number;
  /** 0..1 — 7C/7D nhân vào điểm taste; 0 = chưa đủ dữ liệu. */
  weight: number;
  topLiked: RankedTag[];
  topDisliked: RankedTag[];
  topWorkouts: RankedWorkout[];
  chat_summary: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addScore(
  bag: Record<string, number>,
  tags: string[],
  weight: number,
): void {
  for (const tag of tags) {
    bag[tag] = Math.round(((bag[tag] ?? 0) + weight) * 100) / 100;
  }
}

function topTags(bag: Record<string, number>, n: number): RankedTag[] {
  return Object.entries(bag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, score]) => ({ tag, score }));
}

function topWorkouts(bag: Record<string, number>, n: number): RankedWorkout[] {
  return Object.entries(bag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([activity, count]) => ({ activity, count }));
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    @InjectRepository(UserTasteProfile)
    private readonly tasteRepo: Repository<UserTasteProfile>,
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
  ) {
    this.foodDict = null;
  }

  private foodDict: { at: number; items: FoodNorm[] } | null;

  // ---- Ghi tín hiệu (fire-and-forget từ caller: `void insights.recordX`) ----

  /** Bữa ăn đã log → cộng tag liked. names: food_name_vi (+en). */
  async recordMeal(userId: string, names: string[], weight = 1): Promise<void> {
    await this.safe(async () => {
      const tags = names.flatMap((n) => tokenizeTaste(n ?? ''));
      await this.bump(userId, { liked: tags, weight, interactions: 1 });
    });
  }

  /** Món yêu thích → tín hiệu mạnh gấp đôi. */
  async recordFavorite(
    userId: string,
    names: string[],
    weight = 2,
  ): Promise<void> {
    await this.safe(async () => {
      const tags = names.flatMap((n) => tokenizeTaste(n ?? ''));
      await this.bump(userId, { liked: tags, weight, interactions: 1 });
    });
  }

  /** Buổi tập đã log → cộng workout_prefs theo activity_type. */
  async recordWorkout(userId: string, activity: string): Promise<void> {
    await this.safe(async () => {
      const profile = await this.getOrCreate(userId);
      const key = (activity ?? '').toUpperCase();
      if (!key) return;
      profile.workout_prefs[key] = (profile.workout_prefs[key] ?? 0) + 1;
      profile.interactions += 1;
      await this.tasteRepo.save(profile);
    });
  }

  /** Like bài community → cộng nhẹ tag từ nội dung (ngầm, không nút hide). */
  async recordCommunityLike(
    userId: string,
    content: string,
    weight = 0.5,
  ): Promise<void> {
    await this.safe(async () => {
      const tags = tokenizeTaste(content ?? '');
      if (tags.length === 0) return;
      await this.bump(userId, { liked: tags, weight, interactions: 1 });
    });
  }

  /** Plan bị bỏ (verdict OFF_TRACK) → phạt nhẹ món được gợi ý nhưng không theo. */
  async recordPlanSkipped(
    userId: string,
    suggestions: string[],
    weight = 0.5,
  ): Promise<void> {
    await this.safe(async () => {
      const tags = suggestions.flatMap((s) => tokenizeTaste(s ?? ''));
      if (tags.length === 0) return;
      await this.bump(userId, { disliked: tags, weight, interactions: 1 });
    });
  }

  /** Chat nhắc đến món/tập (7E) → tín hiệu quan tâm nhẹ, không LLM. */
  async recordChatMention(
    userId: string,
    content: string,
    weight = 0.3,
  ): Promise<void> {
    await this.safe(async () => {
      const norm = toSearchNorm(content ?? '');
      if (!norm) return;
      const { foodTags, activities } = mineMentions(
        norm,
        await this.getFoodDict(),
        ACTIVITY_NORMS,
      );
      if (foodTags.length === 0 && activities.length === 0) return;
      const profile = await this.getOrCreate(userId);
      if (foodTags.length > 0) addScore(profile.liked_tags, foodTags, weight);
      for (const a of activities) {
        profile.workout_prefs[a] = round2(
          (profile.workout_prefs[a] ?? 0) + weight,
        );
      }
      profile.interactions += 1;
      await this.tasteRepo.save(profile);
    });
  }

  // ---- Đọc (7C/7D/7F + prompt AI dùng) ----

  async getProfile(userId: string): Promise<TasteProfile> {
    const p = await this.tasteRepo.findOne({ where: { user_id: userId } });
    const liked = p?.liked_tags ?? {};
    const disliked = p?.disliked_tags ?? {};
    const workouts = p?.workout_prefs ?? {};
    return {
      liked_tags: liked,
      disliked_tags: disliked,
      workout_prefs: workouts,
      interactions: p?.interactions ?? 0,
      weight: this.tasteWeight(p),
      topLiked: topTags(liked, 20),
      topDisliked: topTags(disliked, 20),
      topWorkouts: topWorkouts(workouts, 10),
      chat_summary: p?.chat_summary ?? null,
    };
  }

  /** Lưu tóm tắt sở thích từ chat (cron hàng tuần gọi, Phase 8). */
  async saveChatSummary(userId: string, summary: string): Promise<void> {
    await this.safe(async () => {
      const profile = await this.getOrCreate(userId);
      profile.chat_summary = summary.trim().slice(0, 1000);
      profile.chat_summary_at = new Date();
      await this.tasteRepo.save(profile);
    });
  }

  // Khối context RAG cho prompt AI (suggest-menu/plan): gu + tóm tắt chat.
  // Trả '' khi chưa đủ dữ liệu — caller chèn thẳng vào prompt.
  async tasteContextBlock(userId: string): Promise<string> {
    try {
      const t = await this.getProfile(userId);
      const parts: string[] = [];
      if (t.weight > 0) {
        if (t.topLiked.length > 0) {
          parts.push(
            `Hay ăn/quan tâm: ${t.topLiked
              .slice(0, 8)
              .map((x) => x.tag)
              .join(', ')}`,
          );
        }
        if (t.topDisliked.length > 0) {
          parts.push(
            `Hay bỏ qua: ${t.topDisliked
              .slice(0, 5)
              .map((x) => x.tag)
              .join(', ')}`,
          );
        }
        if (t.topWorkouts.length > 0) {
          parts.push(
            `Hay tập: ${t.topWorkouts
              .slice(0, 3)
              .map((x) => x.activity)
              .join(', ')}`,
          );
        }
      }
      if (t.chat_summary) {
        parts.push(`User tự chia sẻ qua chat: ${t.chat_summary}`);
      }
      if (parts.length === 0) return '';
      return `Sở thích ngầm (ưu tiên mềm, TUYỆT ĐỐI không ghi đè dị ứng/chế độ ăn): ${parts.join(' | ')}.`;
    } catch (error) {
      this.logger.warn(`Dựng taste context thất bại: ${String(error)}`);
      return '';
    }
  }

  // ---- Cron đêm: decay + tỉa (gu cũ mờ dần, half-life 90 ngày) ----

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async decayTaste(): Promise<{ pruned: number }> {
    let pruned = 0;
    const profiles = await this.tasteRepo.find();
    for (const p of profiles) {
      let changed = false;
      for (const bag of [p.liked_tags, p.disliked_tags, p.workout_prefs]) {
        for (const key of Object.keys(bag)) {
          const next = Math.round(bag[key] * DAILY_DECAY * 100) / 100;
          if (next < PRUNE_BELOW) {
            delete bag[key];
            pruned += 1;
          } else if (next !== bag[key]) {
            bag[key] = next;
          }
          changed = true;
        }
      }
      if (changed) await this.tasteRepo.save(p);
    }
    if (pruned > 0) this.logger.log(`Taste decay: tỉa ${pruned} tag mờ.`);
    return { pruned };
  }

  // ---- Helpers ----

  private tasteWeight(p: UserTasteProfile | null): number {
    if (!p || p.interactions < MIN_INTERACTIONS) return 0;
    const ageDays = (Date.now() - p.created_at.getTime()) / 86400000;
    if (ageDays < MIN_AGE_DAYS) return 0;
    return Math.min(1, p.interactions / FULL_WEIGHT_AT);
  }

  private async getOrCreate(userId: string): Promise<UserTasteProfile> {
    const found = await this.tasteRepo.findOne({ where: { user_id: userId } });
    if (found) {
      found.liked_tags ??= {};
      found.disliked_tags ??= {};
      found.workout_prefs ??= {};
      return found;
    }
    return this.tasteRepo.create({
      user_id: userId,
      liked_tags: {},
      disliked_tags: {},
      workout_prefs: {},
      interactions: 0,
    });
  }

  private async bump(
    userId: string,
    patch: {
      liked?: string[];
      disliked?: string[];
      weight: number;
      interactions: number;
    },
  ): Promise<void> {
    if (
      (!patch.liked || patch.liked.length === 0) &&
      (!patch.disliked || patch.disliked.length === 0)
    ) {
      return;
    }
    const profile = await this.getOrCreate(userId);
    if (patch.liked) addScore(profile.liked_tags, patch.liked, patch.weight);
    if (patch.disliked)
      addScore(profile.disliked_tags, patch.disliked, patch.weight);
    profile.interactions += patch.interactions;
    await this.tasteRepo.save(profile);
  }

  private async safe(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn(`Ghi taste thất bại (bỏ qua): ${String(error)}`);
    }
  }

  // Từ điển món ăn build từ catalog foods, cache 1h (tránh query mỗi tin nhắn).
  private async getFoodDict(): Promise<FoodNorm[]> {
    if (this.foodDict && Date.now() - this.foodDict.at < 3600000) {
      return this.foodDict.items;
    }
    const foods = await this.foodRepo.find();
    const items = foodNorms(foods);
    this.foodDict = { at: Date.now(), items };
    return items;
  }
}
