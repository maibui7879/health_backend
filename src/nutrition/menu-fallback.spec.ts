import { fallbackMenu, fallbackPlan } from './menu-fallback';
describe('static menus', () => {
  it('selects the nearest energy level with three meals and basic macros', () => {
    const result = fallbackMenu({ kcalTarget: 1750 });
    expect(result.template_kcal).toBe(1800);
    expect(result.total_kcal).toBe(1800);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].protein_g).toBeGreaterThan(0);
  });
  it('does not assert a static menu is safe for unverified allergies', () => {
    expect(
      fallbackMenu({ kcalTarget: 1800, userAllergies: ['sữa'] }).items,
    ).toEqual([]);
  });
  it('preserves the requested plan duration', () => {
    const plan = fallbackPlan({
      dailyKcalTarget: 2000,
      durationDays: 14,
      dietType: 'VEGAN',
    });
    expect(plan.days).toHaveLength(14);
    expect(plan.days[0].meals).toHaveLength(3);
  });
});
