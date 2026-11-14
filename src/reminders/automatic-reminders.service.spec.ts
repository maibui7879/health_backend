import { waterReminderDue } from './automatic-reminders.service';
describe('water reminder progress', () => {
  it('applies 40% and 75% thresholds and stops when achieved', () => {
    expect(waterReminderDue('14:00', '11:00', '20:30', 60, 799, 2000)).toBe(
      true,
    );
    expect(waterReminderDue('14:00', '11:00', '20:30', 60, 800, 2000)).toBe(
      false,
    );
    expect(waterReminderDue('19:00', '11:00', '20:30', 60, 1499, 2000)).toBe(
      true,
    );
    expect(waterReminderDue('19:00', '11:00', '20:30', 60, 1500, 2000)).toBe(
      false,
    );
  });
  it('respects quiet hours, intervals and absent targets', () => {
    expect(waterReminderDue('21:00', '11:00', '20:30', 60, 0, 2000)).toBe(
      false,
    );
    expect(waterReminderDue('11:01', '11:00', '20:30', 120, 0, 2000)).toBe(
      false,
    );
    expect(waterReminderDue('11:00', '11:00', '20:30', 120, 0, 0)).toBe(false);
  });
});
