import { UserProfile } from './entities/user-profile.entity';

export const ACTIVITY_FACTORS: Record<string, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
};

export function healthMetrics(
  profile: Pick<
    Partial<UserProfile>,
    | 'current_weight_kg'
    | 'height_cm'
    | 'date_of_birth'
    | 'gender'
    | 'bmr_formula'
    | 'activity_level'
    | 'goal_type'
    | 'hydration_restricted'
  >,
  now = new Date(),
) {
  const weight = Number(profile.current_weight_kg);
  const height = Number(profile.height_cm);
  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
  let age: number | null = null;
  if (dob && Number.isFinite(dob.getTime())) {
    age = now.getUTCFullYear() - dob.getUTCFullYear();
    if (
      now.getUTCMonth() < dob.getUTCMonth() ||
      (now.getUTCMonth() === dob.getUTCMonth() &&
        now.getUTCDate() < dob.getUTCDate())
    )
      age--;
  }
  let bmr: number | null = null;
  if (
    weight > 0 &&
    height > 0 &&
    age !== null &&
    age >= 18 &&
    age <= 120 &&
    ['MALE', 'FEMALE'].includes(profile.gender ?? '')
  ) {
    const male = profile.gender === 'MALE';
    switch (profile.bmr_formula) {
      case 'HARRIS_BENEDICT':
        bmr = male
          ? 66.473 + 13.7516 * weight + 5.0033 * height - 6.755 * age
          : 655.0955 + 9.5634 * weight + 1.8496 * height - 4.6756 * age;
        break;
      case 'ROZA_SHIZGAL':
        bmr = male
          ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
          : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
        break;
      default:
        bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    }
  }
  const factor = ACTIVITY_FACTORS[profile.activity_level ?? 'SEDENTARY'] ?? 1.2;
  const tdee = bmr === null ? null : Math.round(bmr * factor);
  const kcal =
    tdee === null
      ? null
      : Math.max(
          1,
          tdee +
            (profile.goal_type === 'LOSE_WEIGHT'
              ? -500
              : profile.goal_type === 'GAIN_MUSCLE'
                ? 300
                : 0),
        );
  // Water coefficients are configurable product estimates, not medical prescriptions.
  const waterRestricted = profile.hydration_restricted === true;
  const water =
    weight > 0 && !waterRestricted
      ? Math.round(weight * 35 * (1 + (factor - 1.2) * 0.25))
      : null;
  return {
    age,
    bmr: bmr === null ? null : Math.round(bmr),
    tdee,
    daily_kcal_target: kcal,
    daily_water_target: water,
    bmr_formula: profile.bmr_formula ?? 'MIFFLIN_ST_JEOR',
    hydration_requires_professional_advice: waterRestricted,
  };
}
