import { toSearchNorm } from '../nutrition/search-norm';
import { tokenizeTaste } from './taste-tokenizer';

// Từ điển NER không-AI cho chat (Phase 7E): món ăn = chính catalog foods
// (caller truyền norms build từ DB), activity = alias vi+en dưới đây.
// Khớp biên từ để 'cá' không dính 'các', 'bò' không dính 'bột'.

export const ACTIVITY_ALIASES: Record<string, string[]> = {
  RUNNING: ['running', 'chạy bộ', 'chạy', 'jogging'],
  CYCLING: ['cycling', 'đạp xe', 'xe đạp'],
  WEIGHT_LIFTING: ['tập tạ', 'đẩy tạ', 'nâng tạ', 'gym', 'weight lifting'],
  YOGA: ['yoga', 'tập yoga'],
  SWIMMING: ['swimming', 'bơi', 'bơi lội', 'đi bơi'],
  CARDIO: ['cardio', 'aerobic', 'thể dục'],
};

export const ACTIVITY_NORMS: { activity: string; norms: string[] }[] =
  Object.entries(ACTIVITY_ALIASES).map(([activity, aliases]) => ({
    activity,
    norms: aliases.map((a) => toSearchNorm(a)).filter((n) => n.length >= 2),
  }));

export type FoodNorm = { norm: string; tags: string[] };

export function foodNorms(
  foods: { food_name_vi?: string | null; food_name_en?: string | null }[],
): FoodNorm[] {
  // Mỗi biến thể tên (vi / en) là 1 entry riêng để chat "ăn phở bò"
  // khớp được món 'Phở bò'/'Beef pho' (norm gộp cả 2 tên thì không khớp).
  const out: FoodNorm[] = [];
  for (const f of foods) {
    const tags = tokenizeTaste(
      `${f.food_name_vi ?? ''} ${f.food_name_en ?? ''}`,
    );
    const vi = toSearchNorm(f.food_name_vi ?? '');
    const en = toSearchNorm(f.food_name_en ?? '');
    if (vi.length >= 2) out.push({ norm: vi, tags });
    if (en.length >= 2 && en !== vi) out.push({ norm: en, tags });
  }
  return out;
}

function boundaryIncludes(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,.!?;:])${esc}(?=[\\s,.!?;:]|$)`).test(haystack);
}

export function mineMentions(
  normText: string,
  foods: FoodNorm[],
  activities: { activity: string; norms: string[] }[] = ACTIVITY_NORMS,
): { foodTags: string[]; activities: string[] } {
  const foodTags = new Set<string>();
  for (const f of foods) {
    if (boundaryIncludes(normText, f.norm)) {
      for (const t of f.tags) foodTags.add(t);
    }
  }
  const found = new Set<string>();
  for (const a of activities) {
    if (a.norms.some((n) => boundaryIncludes(normText, n))) {
      found.add(a.activity);
    }
  }
  return { foodTags: [...foodTags], activities: [...found] };
}
