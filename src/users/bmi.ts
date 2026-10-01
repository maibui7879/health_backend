export type BmiCategory = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE';

export function calcBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): number | null {
  if (
    typeof heightCm !== 'number' ||
    typeof weightKg !== 'number' ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number | null): BmiCategory | null {
  if (bmi === null) return null;
  if (bmi < 18.5) return 'UNDERWEIGHT';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVERWEIGHT';
  return 'OBESE';
}
