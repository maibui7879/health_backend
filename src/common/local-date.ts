import { BadRequestException } from '@nestjs/common';

export const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function localDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function dateRange(from?: string, to?: string): string[] {
  const end = to ?? localDate();
  for (const value of [from, end].filter((v): v is string => v !== undefined)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'Ngày phải có định dạng YYYY-MM-DD hợp lệ.',
      );
    }
  }
  const start = from ?? shiftDate(end, -6);
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (days < 0 || days > 365) {
    throw new BadRequestException('Khoảng ngày phải từ 1 đến 366 ngày.');
  }
  return Array.from({ length: days + 1 }, (_, i) => shiftDate(start, i));
}

export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
