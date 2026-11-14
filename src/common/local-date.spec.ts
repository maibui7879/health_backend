import { dateRange, localDate } from './local-date';
describe('local dates', () => {
  it('changes day at Vietnamese midnight', () => {
    expect(localDate(new Date('2026-11-14T16:59:59Z'))).toBe('2026-11-14');
    expect(localDate(new Date('2026-11-14T17:00:00Z'))).toBe('2026-11-15');
  });
  it('includes empty calendar days and bounds queries', () => {
    expect(dateRange('2026-02-27', '2026-03-01')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(() => dateRange('2026-02-30', '2026-03-01')).toThrow();
    expect(() => dateRange('2020-01-01', '2026-01-01')).toThrow();
  });
});
