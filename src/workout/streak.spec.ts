import { currentStreak, dayCounts, longestStreak } from './streak';

describe('streak', () => {
  it('ngày không log không tính', () => {
    expect(
      dayCounts({
        date: '2026-10-05',
        hasWorkout: false,
        hasMedia: false,
        hasViewedMedia: false,
      }),
    ).toBe(false);
  });

  it('ngày có media nhưng chưa xem hết không tính', () => {
    expect(
      dayCounts({
        date: '2026-10-05',
        hasWorkout: true,
        hasMedia: true,
        hasViewedMedia: false,
      }),
    ).toBe(false);
    expect(
      dayCounts({
        date: '2026-10-05',
        hasWorkout: true,
        hasMedia: true,
        hasViewedMedia: true,
      }),
    ).toBe(true);
    expect(
      dayCounts({
        date: '2026-10-05',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      }),
    ).toBe(true);
  });

  it('currentStreak đếm ngược từ hôm nay, gãy thì dừng', () => {
    const days = [
      {
        date: '2026-10-05',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-04',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-03',
        hasWorkout: false,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-02',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
    ];
    expect(currentStreak(days, '2026-10-05')).toBe(2);
  });

  it('hôm nay chưa tập thì tính từ hôm qua', () => {
    const days = [
      {
        date: '2026-10-04',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
    ];
    expect(currentStreak(days, '2026-10-05')).toBe(1);
  });

  it('longestStreak bắt mạch dài nhất, reset khi đứt', () => {
    const days = [
      {
        date: '2026-10-01',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-02',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-03',
        hasWorkout: false,
        hasMedia: false,
        hasViewedMedia: false,
      },
      {
        date: '2026-10-04',
        hasWorkout: true,
        hasMedia: false,
        hasViewedMedia: false,
      },
    ];
    expect(longestStreak(days)).toBe(2);
  });
});
