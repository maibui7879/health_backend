import { bmiCategory, calcBmi } from './bmi';

describe('bmi', () => {
  it('tính đúng BMI phổ biến', () => {
    // 70kg / 1.7m
    expect(calcBmi(170, 70)).toBe(24.2);
  });

  it('trả null khi thiếu/sai số liệu', () => {
    expect(calcBmi(null, 70)).toBeNull();
    expect(calcBmi(170, null)).toBeNull();
    expect(calcBmi(0, 70)).toBeNull();
    expect(calcBmi(170, -5)).toBeNull();
    expect(calcBmi(Number.NaN, 70)).toBeNull();
  });

  it('phân loại đúng ngưỡng WHO', () => {
    expect(bmiCategory(null)).toBeNull();
    expect(bmiCategory(17)).toBe('UNDERWEIGHT');
    expect(bmiCategory(18.5)).toBe('NORMAL');
    expect(bmiCategory(24.9)).toBe('NORMAL');
    expect(bmiCategory(25)).toBe('OVERWEIGHT');
    expect(bmiCategory(29.9)).toBe('OVERWEIGHT');
    expect(bmiCategory(30)).toBe('OBESE');
  });
});
