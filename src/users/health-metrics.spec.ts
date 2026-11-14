import { healthMetrics } from './health-metrics';

describe('healthMetrics', () => {
  const base = {
    current_weight_kg: 70,
    height_cm: 170,
    gender: 'MALE',
    date_of_birth: new Date('1996-06-15'),
    activity_level: 'SEDENTARY',
  };
  const now = new Date('2026-06-14T12:00:00Z');
  it('calculates age before birthday and separates BMR, TDEE and goal', () => {
    expect(
      healthMetrics({ ...base, goal_type: 'LOSE_WEIGHT' }, now),
    ).toMatchObject({
      age: 29,
      bmr: 1623,
      tdee: 1947,
      daily_kcal_target: 1447,
    });
  });
  it('computes water with weight alone', () => {
    expect(healthMetrics({ current_weight_kg: 70 }, now)).toMatchObject({
      daily_water_target: 2450,
      bmr: null,
      tdee: null,
    });
  });
  it('does not prescribe an automatic water target for restricted profiles', () => {
    expect(
      healthMetrics({ ...base, hydration_restricted: true }, now)
        .daily_water_target,
    ).toBeNull();
  });
  it('supports the two Harris Benedict variants', () => {
    expect(
      healthMetrics({ ...base, bmr_formula: 'HARRIS_BENEDICT' }, now).bmr,
    ).toBe(1684);
    expect(
      healthMetrics({ ...base, bmr_formula: 'ROZA_SHIZGAL' }, now).bmr,
    ).toBe(1677);
  });
  it('does not apply adult energy equations to children or unsupported gender', () => {
    expect(
      healthMetrics({ ...base, date_of_birth: new Date('2020-01-01') }, now)
        .tdee,
    ).toBeNull();
    expect(healthMetrics({ ...base, gender: 'OTHER' }, now).tdee).toBeNull();
  });
});
