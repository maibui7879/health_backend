// Chuẩn hóa tên món để tìm kiếm mờ — PHẢI khớp quy tắc SQL trong
// migration 011 (translate map 67 ký tự + lower + gộp khoảng trắng).
// Đổi map ở đây thì sinh migration mới backfill lại search_norm.

const VI_MAP: Array<[RegExp, string]> = [
  [/[áàạảãâầấậẩẫăằắặẳẵ]/g, 'a'],
  [/[èéẹẻẽêềếệểễ]/g, 'e'],
  [/[ìíịỉĩ]/g, 'i'],
  [/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o'],
  [/[ùúụủũưừứựửữ]/g, 'u'],
  [/[ỳýỵỷỹ]/g, 'y'],
  [/đ/g, 'd'],
];

export function toSearchNorm(input: string): string {
  let out = input.toLowerCase();
  for (const [re, rep] of VI_MAP) out = out.replace(re, rep);
  return out.replace(/\s+/g, ' ').trim();
}

// Escape ký tự đặc biệt LIKE (%, _, \) trong từ khóa user nhập.
export function escapeLike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
