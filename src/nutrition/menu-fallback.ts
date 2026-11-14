// Product demo templates; macros and energy are estimates, not a clinical meal plan.
export const MENU_LEVELS = [1500, 1800, 2000];
const MENUS: Record<string, string[]> = {
  STANDARD: [
    'Yến mạch, chuối và sữa chua',
    'Cơm, ức gà và rau luộc',
    'Khoai lang, cá và rau xanh',
  ],
  VEGAN: [
    'Yến mạch nấu nước và chuối',
    'Cơm, đậu lăng và rau luộc',
    'Khoai lang, đậu đỏ và rau xanh',
  ],
  VEGETARIAN: [
    'Yến mạch, chuối và sữa chua',
    'Cơm, trứng và rau luộc',
    'Khoai lang, đậu đỏ và rau xanh',
  ],
  KETO: [
    'Trứng, quả bơ và rau xanh',
    'Ức gà, bí ngòi và dầu ô liu',
    'Cá, súp lơ và dầu ô liu',
  ],
  PALEO: [
    'Trứng, chuối và quả bơ',
    'Ức gà, khoai lang và rau luộc',
    'Cá, bí đỏ và rau xanh',
  ],
  HALAL: [
    'Yến mạch nấu nước và chuối',
    'Cơm, đậu lăng và rau luộc',
    'Khoai lang, đậu đỏ và rau xanh',
  ],
};

export interface StaticMenuItem {
  food_name_vi: string;
  meal_type: string;
  estimated_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  reason: string;
}
export interface StaticMenu {
  source: string;
  requires_review: boolean;
  meal_type: string;
  total_kcal: number;
  template_kcal?: number;
  reason?: string;
  items: StaticMenuItem[];
}

export function fallbackMenu(args: {
  kcalTarget: number;
  mealType?: string;
  dietType?: string;
  userAllergies?: string[];
}): StaticMenu {
  const diet = args.dietType ?? 'STANDARD';
  // Unknown allergies cannot be verified against a small static ingredient catalog.
  // Return an explicit empty result instead of asserting a template is safe.
  if ((args.userAllergies?.length ?? 0) > 0 || !MENUS[diet]) {
    return {
      source: 'STATIC_FALLBACK',
      requires_review: true,
      meal_type: args.mealType ?? 'LUNCH',
      total_kcal: 0,
      items: [],
      reason: 'Cần kiểm tra dị ứng/chế độ ăn trước khi dùng thực đơn mẫu.',
    };
  }
  const equivalentDaily = args.mealType ? args.kcalTarget * 3 : args.kcalTarget;
  const level = MENU_LEVELS.reduce((best, n) =>
    Math.abs(n - equivalentDaily) < Math.abs(best - equivalentDaily) ? n : best,
  );
  const types = ['BREAKFAST', 'LUNCH', 'DINNER'];
  const shares = [0.3, 0.4, 0.3];
  const items = MENUS[diet]
    .map((name, index) => {
      const kcal = Math.round(level * shares[index]);
      return {
        food_name_vi: name,
        meal_type: types[index],
        estimated_kcal: kcal,
        protein_g: Math.round((kcal * (diet === 'KETO' ? 0.25 : 0.2)) / 4),
        carbs_g: Math.round((kcal * (diet === 'KETO' ? 0.05 : 0.5)) / 4),
        fat_g: Math.round((kcal * (diet === 'KETO' ? 0.7 : 0.3)) / 9),
        reason:
          'Khẩu phần mẫu ước tính; điều chỉnh lượng thực phẩm theo mục tiêu.',
      };
    })
    .filter((item) => !args.mealType || item.meal_type === args.mealType);
  return {
    source: 'STATIC_FALLBACK',
    requires_review: true,
    template_kcal: level,
    meal_type: args.mealType ?? 'LUNCH',
    total_kcal: items.reduce((sum, item) => sum + item.estimated_kcal, 0),
    items,
  };
}

export function fallbackPlan(args: {
  dailyKcalTarget?: number;
  durationDays?: number;
  dietType?: string;
  userAllergies?: string[];
}) {
  const menu = fallbackMenu({
    ...args,
    kcalTarget: args.dailyKcalTarget ?? 1800,
  });
  return {
    source: 'STATIC_FALLBACK',
    requires_review: true,
    duration_days: args.durationDays ?? 7,
    goal_summary:
      'Thực đơn mẫu dự phòng. Năng lượng và macro là ước tính, cần kiểm tra khẩu phần.',
    days: Array.from({ length: args.durationDays ?? 7 }, (_, i) => ({
      day: i + 1,
      meals: menu.items.map((item) => ({
        meal_type: item.meal_type,
        suggestion: item.food_name_vi,
        kcal: item.estimated_kcal,
      })),
      tip: menu.items.length
        ? 'Điều chỉnh khẩu phần trước khi ghi nhật ký.'
        : 'Cần kiểm tra dị ứng/chế độ ăn; chưa có mẫu phù hợp.',
    })),
  };
}
