import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InsightsService } from '../insights/insights.service';
import { tokenizeTaste } from '../insights/taste-tokenizer';
import { UsersService } from '../users/users.service';
import { SuggestQueryDto } from './dto/suggest-query.dto';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';
import { Meal } from './entities/meal.entity';
import { NutritionPlan, PlanStatus } from './entities/nutrition-plan.entity';

// Gợi ý món bằng rule thuần (Phase 7C) — 0 token, 0 gọi AI.
// score = macro_fit(goal+diet) + taste(gu ngầm) − recent_penalty + adherence_boost
// Ràng buộc cứng (dị ứng, VEGAN) loại trước; gu chỉ xếp hạng trong tập an toàn.

const RECENT_DAYS = 3;
const RECENT_PENALTY = 1.5;
const ADHERENCE_BOOST = 1;
const SYNONYM_FACTOR = 0.5;

// Token món mặn (vi+en). 'bơ' cố ý vắng mặt để khỏi loại nhầm Quả bơ.
const NON_VEGAN_TOKENS = new Set(
  'thịt bò gà vịt heo lợn cá tôm mực cua ốc trứng sữa butter cheese beef pork chicken duck fish shrimp squid egg milk sausage ham'.split(
    ' ',
  ),
);

export type SuggestReason = { code: string; tags?: string[] };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// pgvector trả về chuỗi "[0.1,0.2,...]" — parse ra mảng số, sai thì null.
function parseVector(raw: unknown): number[] | null {
  if (typeof raw !== 'string') return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nums = arr.map((v) => Number(v));
    if (nums.some((v) => !Number.isFinite(v))) return null;
    return nums;
  } catch {
    return null;
  }
}

// Gu vector = trung bình cộng embedding các món đã thích/ăn.
function averageVectors(vectors: number[][]): number[] {
  const dim = vectors[0]?.length ?? 0;
  const avg = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim && i < v.length; i++) {
      avg[i] = (avg[i] ?? 0) + (v[i] ?? 0);
    }
  }
  return avg.map((s) => s / vectors.length);
}

// Cầu nối song ngữ không-AI: token cùng xuất hiện trong 1 món (vi+en)
// coi như đồng nghĩa 1 hop (gà ↔ chicken, phở ↔ pho).
function buildSynonyms(foods: Food[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const f of foods) {
    const tokens = tokenizeTaste(
      `${f.food_name_vi ?? ''} ${f.food_name_en ?? ''}`,
    );
    for (const t of tokens) {
      let set = map.get(t);
      if (!set) {
        set = new Set();
        map.set(t, set);
      }
      for (const o of tokens) if (o !== t) set.add(o);
    }
  }
  return map;
}

function expandLiked(
  liked: Record<string, number>,
  syn: Map<string, Set<string>>,
): Record<string, number> {
  const out: Record<string, number> = { ...liked };
  for (const [tag, score] of Object.entries(liked)) {
    const others = syn.get(tag);
    if (!others) continue;
    for (const o of others) {
      out[o] = round2((out[o] ?? 0) + score * SYNONYM_FACTOR);
    }
  }
  return out;
}

function macroFit(
  food: Pick<Food, 'kcal_100g' | 'protein_100g' | 'carbs_100g'>,
  goal: string,
  diet: string,
): number {
  const protein = Math.min(food.protein_100g / 15, 1.2);
  let kcal = 0;
  if (goal === 'LOSE_WEIGHT') {
    kcal =
      food.kcal_100g <= 120
        ? 0.8
        : Math.max(0, 0.8 * (1 - (food.kcal_100g - 120) / 280));
  } else if (goal === 'GAIN_MUSCLE') {
    kcal = Math.min(0.8, food.kcal_100g / 400);
  } else {
    kcal = Math.max(0, 0.8 - Math.abs(food.kcal_100g - 150) / 300);
  }
  let dietAdj = 0;
  if (diet === 'KETO') {
    dietAdj = food.carbs_100g <= 5 ? 0.3 : food.carbs_100g > 10 ? -1 : 0;
  }
  return round2(protein + kcal + dietAdj);
}

function findPlanDay(
  items: unknown,
  dayIndex: number,
): { meals?: { suggestion?: string }[] } | null {
  if (!Array.isArray(items)) return null;
  const entries = items as {
    day?: number;
    meals?: { suggestion?: string }[];
  }[];
  const byDay = entries.find((e) => Number(e?.day) === dayIndex + 1);
  if (byDay) return byDay;
  return entries[dayIndex] ?? null;
}

@Injectable()
export class SuggestService {
  private readonly logger = new Logger(SuggestService.name);

  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    @InjectRepository(Meal)
    private readonly mealRepo: Repository<Meal>,
    @InjectRepository(NutritionPlan)
    private readonly planRepo: Repository<NutritionPlan>,
    @InjectRepository(FavoriteFood)
    private readonly favRepo: Repository<FavoriteFood>,
    private readonly usersService: UsersService,
    private readonly insights: InsightsService,
  ) {}

  async suggest(userId: string, dto: SuggestQueryDto) {
    const limit = Math.min(Math.max(dto.limit ?? 10, 1), 30);
    const [foods, taste, me] = await Promise.all([
      this.foodRepo.find(),
      this.insights.getProfile(userId),
      this.usersService.getMe(userId).catch(() => null),
    ]);

    const profile = (me?.profile ?? {}) as {
      goal_type?: string;
      diet_type?: string;
    };
    const goal = profile.goal_type ?? 'MAINTAIN';
    const diet = profile.diet_type ?? 'STANDARD';
    const allergyTokens = new Set(
      ((me?.allergies ?? []) as { allergen_name?: string }[]).flatMap((a) =>
        tokenizeTaste(a?.allergen_name ?? ''),
      ),
    );
    const vegan = diet === 'VEGAN';

    // Lọc cứng: dị ứng + VEGAN (ràng buộc explicit, gu không được ghi đè).
    const candidates = foods.filter((f) => {
      const tokens = tokenizeTaste(
        `${f.food_name_vi ?? ''} ${f.food_name_en ?? ''}`,
      );
      if (tokens.some((t) => allergyTokens.has(t))) return false;
      if (vegan && tokens.some((t) => NON_VEGAN_TOKENS.has(t))) return false;
      return true;
    });

    const syn = buildSynonyms(foods);
    const liked = expandLiked(taste.liked_tags, syn);
    const disliked = taste.disliked_tags;

    const eaten = await this.recentEatenNames(userId);
    const proven = await this.provenTokens(userId, eaten);

    const scored = candidates.map((f) => {
      const tokens = tokenizeTaste(
        `${f.food_name_vi ?? ''} ${f.food_name_en ?? ''}`,
      );
      const fit = macroFit(f, goal, diet);
      let tasteScore = 0;
      const matchedLiked: Array<{ tag: string; score: number }> = [];
      const matchedDisliked: string[] = [];
      for (const t of tokens) {
        const l = liked[t] ?? 0;
        const d = disliked[t] ?? 0;
        if (l > 0) matchedLiked.push({ tag: t, score: l });
        if (d > 0) matchedDisliked.push(t);
        tasteScore += l - d;
      }
      tasteScore = round2(tasteScore * taste.weight);
      const recent = eaten.has((f.food_name_vi ?? '').toLowerCase());
      const provenHit = tokens.some((t) => proven.has(t));

      const total = round2(
        fit +
          tasteScore -
          (recent ? RECENT_PENALTY : 0) +
          (provenHit ? ADHERENCE_BOOST : 0),
      );
      const reasons: SuggestReason[] = [];
      if (provenHit) reasons.push({ code: 'adherence_proven' });
      if (matchedLiked.length > 0)
        reasons.push({
          code: 'taste_match',
          tags: matchedLiked
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((m) => m.tag),
        });
      if (fit >= 1) reasons.push({ code: 'goal_fit' });
      if (!recent) reasons.push({ code: 'variety' });

      return {
        id: f.id,
        food_name_vi: f.food_name_vi,
        food_name_en: f.food_name_en,
        kcal_100g: f.kcal_100g,
        protein_100g: f.protein_100g,
        carbs_100g: f.carbs_100g,
        fat_100g: f.fat_100g,
        source: f.source ?? null,
        score: {
          macro_fit: fit,
          taste: tasteScore,
          recent_penalty: recent ? RECENT_PENALTY : 0,
          adherence_boost: provenHit ? ADHERENCE_BOOST : 0,
          total,
        },
        reasons: reasons.slice(0, 3),
      };
    });

    scored.sort((a, b) => b.score.total - a.score.total);
    return {
      suggestions: scored.slice(0, limit),
      meta: {
        goal,
        diet,
        taste_weight: taste.weight,
        total_candidates: candidates.length,
      },
    };
  }

  // Món mới hợp gu bằng vector (Phase 8): trung bình embedding của món
  // user đã thích/ăn → tìm món gần nhất chưa từng thử. Không gọi AI lúc
  // request (dùng vector lưu sẵn); DB chưa backfill → trả rỗng + ghi chú.
  async discover(userId: string, dto: SuggestQueryDto) {
    const limit = Math.min(Math.max(dto.limit ?? 10, 1), 30);
    const taste = await this.insights.getProfile(userId).catch(() => null);
    if (!taste || taste.weight === 0) {
      return {
        suggestions: [],
        meta: { reason: 'not_enough_data', taste_weight: 0 },
      };
    }
    const [favs, eaten] = await Promise.all([
      this.favRepo.find({ where: { user_id: userId } }),
      this.recentEatenNames(userId),
    ]);
    const favIds = favs
      .map((f) => f.food_id)
      .filter((id): id is string => !!id);
    const seedNames = [
      ...favs.map((f) => f.food_name_vi),
      ...[...eaten].slice(0, 30),
    ];
    const seeds =
      seedNames.length > 0
        ? await this.foodRepo.find({
            where: [
              ...(favIds.length > 0 ? [{ id: In(favIds) } as object] : []),
              ...(eaten.size > 0
                ? [{ food_name_vi: In([...eaten]) } as object]
                : []),
            ],
          })
        : [];
    const vectors = seeds
      .map((f) => parseVector((f as Food & { embedding?: unknown }).embedding))
      .filter((v): v is number[] => v !== null);
    if (vectors.length === 0) {
      return {
        suggestions: [],
        meta: { reason: 'embeddings_pending', taste_weight: taste.weight },
      };
    }
    const avg = averageVectors(vectors);
    const params: (string | number)[] = [`[${avg.join(',')}]`];
    const clauses: string[] = ['embedding IS NOT NULL'];
    if (favIds.length > 0) {
      params.push(...favIds);
      clauses.push(
        `id NOT IN (${favIds.map((_, i) => `$${params.length - favIds.length + 1 + i}`).join(',')})`,
      );
    }
    if (eaten.size > 0) {
      const names = [...eaten];
      params.push(...names);
      clauses.push(
        `food_name_vi NOT IN (${names.map((_, i) => `$${params.length - names.length + 1 + i}`).join(',')})`,
      );
    }
    params.push(limit);
    const raw: unknown = await this.foodRepo.query(
      `SELECT id, food_name_vi, food_name_en, kcal_100g, protein_100g,
        carbs_100g, fat_100g, source,
        1 - (embedding <=> $1) AS similarity
       FROM foods WHERE ${clauses.join(' AND ')}
       ORDER BY embedding <=> $1 LIMIT $${params.length}`,
      params,
    );
    const rows = raw as (Food & { similarity: number })[];
    return {
      suggestions: rows.map((r) => ({
        ...r,
        similarity: Math.round(Number(r.similarity) * 1000) / 1000,
      })),
      meta: {
        based_on: vectors.length,
        taste_weight: taste.weight,
      },
    };
  }

  // Tên món đã log trong 3 ngày gần nhất (so khớp chính xác, thường hóa).
  private async recentEatenNames(userId: string): Promise<Set<string>> {
    const since = new Date();
    since.setDate(since.getDate() - (RECENT_DAYS - 1));
    const sinceStr = since.toISOString().split('T')[0];
    try {
      const meals = await this.mealRepo
        .createQueryBuilder('m')
        .innerJoin('m.daily_nutrition', 'd')
        .leftJoinAndSelect('m.items', 'it')
        .where('d.user_id = :userId', { userId })
        .andWhere('d.date >= :since', { since: sinceStr })
        .getMany();
      return new Set(
        meals.flatMap((m) =>
          (m.items ?? []).map((it) => (it.food_name_vi ?? '').toLowerCase()),
        ),
      );
    } catch (error) {
      this.logger.warn(
        `Đọc lịch sử ăn thất bại (bỏ penalty): ${String(error)}`,
      );
      return new Set();
    }
  }

  // Token "đã chứng minh": món trong plan ACTIVE 3 ngày gần nhất mà user
  // thực sự đã ăn → nối mục tồn Phase 3 (tự điều chỉnh theo adherence).
  private async provenTokens(
    userId: string,
    eaten: Set<string>,
  ): Promise<Set<string>> {
    try {
      const active = await this.planRepo.find({
        where: {
          user_id: userId,
          status: PlanStatus.ACTIVE,
          is_template: false,
        },
        order: { created_at: 'DESC' },
        take: 1,
      });
      const plan = active[0];
      if (!plan) return new Set();
      const from = new Date(`${plan.date_from}T00:00:00Z`);
      if (Number.isNaN(from.getTime())) return new Set();
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const suggestions: string[] = [];
      for (let back = 0; back < RECENT_DAYS; back++) {
        const dayIndex = Math.round(
          (today.getTime() - back * 86400000 - from.getTime()) / 86400000,
        );
        if (dayIndex < 0) continue;
        const day = findPlanDay(plan.items, dayIndex);
        for (const m of day?.meals ?? []) {
          if (m?.suggestion) suggestions.push(m.suggestion);
        }
      }
      const eatenTokens = new Set([...eaten].flatMap((n) => tokenizeTaste(n)));
      return new Set(
        suggestions
          .flatMap((s) => tokenizeTaste(s))
          .filter((t) => eatenTokens.has(t)),
      );
    } catch (error) {
      this.logger.warn(`Đọc plan ACTIVE thất bại (bỏ boost): ${String(error)}`);
      return new Set();
    }
  }
}
