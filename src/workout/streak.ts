// Tính streak tập (Phase 5C) — hàm thuần để dễ test.
// Một ngày được tính nếu có ≥1 log; nếu ngày đó có log gắn media thì
// phải có ≥1 media đã xem hết (media_viewed_at). Ngày tương lai bỏ qua.
export type DayActivity = {
  date: string;
  hasWorkout: boolean;
  hasMedia: boolean;
  hasViewedMedia: boolean;
};

export function dayCounts(d: DayActivity): boolean {
  if (!d.hasWorkout) return false;
  if (d.hasMedia && !d.hasViewedMedia) return false;
  return true;
}

export function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// streak hiện tại: đếm ngược từ today (nếu hôm nay chưa đạt thì tính từ hôm qua).
export function currentStreak(days: DayActivity[], today: string): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let streak = 0;
  const todayOk = byDate.get(today);
  let cursor =
    todayOk && dayCounts(todayOk)
      ? today
      : toISODate(
          new Date(new Date(`${today}T00:00:00.000Z`).getTime() - 86400000),
        );
  for (;;) {
    const d = byDate.get(cursor);
    if (!d || !dayCounts(d)) break;
    streak += 1;
    cursor = toISODate(
      new Date(new Date(`${cursor}T00:00:00.000Z`).getTime() - 86400000),
    );
  }
  return streak;
}

export function longestStreak(days: DayActivity[]): number {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (!dayCounts(d)) {
      run = 0;
      prev = null;
      continue;
    }
    if (prev) {
      const expected = toISODate(
        new Date(new Date(`${prev}T00:00:00.000Z`).getTime() + 86400000),
      );
      run = d.date === expected ? run + 1 : 1;
    } else {
      run = 1;
    }
    prev = d.date;
    if (run > best) best = run;
  }
  return best;
}
