import { escapeLike, toSearchNorm } from './search-norm';

// Quy tắc PHẢI khớp migration 011 (translate map 67 ký tự).
describe('toSearchNorm', () => {
  it.each([
    ['Phở bò', 'pho bo'],
    ['BÚN CHẢ', 'bun cha'],
    ['Đậu phụ', 'dau phu'],
    ['  Bánh   xèo ', 'banh xeo'],
    ['Cà rốt (củ đỏ, vàng)', 'ca rot (cu do, vang)'],
    ['Ngô vàng', 'ngo vang'],
    ['Thịt gà ta', 'thit ga ta'],
    ['Ỡm ờ', 'om o'],
    ['Beef pho', 'beef pho'],
    ['Rượu cam, chanh', 'ruou cam, chanh'],
  ])('chuẩn hóa %p -> %p', (input, expected) => {
    expect(toSearchNorm(input)).toBe(expected);
  });

  it('escape ký tự LIKE đặc biệt', () => {
    expect(escapeLike('100%_x\\y')).toBe('100\\%\\_x\\\\y');
  });
});
