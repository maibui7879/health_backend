import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { localDate, APP_TIMEZONE } from '../common/local-date';

interface AutomaticReminderRow {
  id: string;
  remind_water: boolean;
  remind_meals: boolean;
  water_start_time: string;
  water_end_time: string;
  water_interval_mins: number;
  hydration_restricted: boolean;
  water_ml: number;
  daily_water_target: number;
  meal_times: Record<string, string> | null;
}

export function waterReminderDue(
  time: string,
  start: string,
  end: string,
  interval: number,
  consumed: number,
  target: number,
): boolean {
  if (target <= 0 || consumed >= target || time < start || time > end)
    return false;
  const minutes = (v: string) =>
    Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const elapsed = minutes(time) - minutes(start);
  if (elapsed % interval !== 0) return false;
  const ratio = consumed / target;
  return ratio < (time >= '19:00' ? 0.75 : time >= '14:00' ? 0.4 : 0.25);
}

@Injectable()
export class AutomaticRemindersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { timeZone: APP_TIMEZONE })
  async sendDue(now = new Date()) {
    const date = localDate(now);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    const rows = await this.users.query<AutomaticReminderRow[]>(
      `SELECT u.id, s.*, p.daily_water_target,
      p.hydration_restricted, COALESCE(l.water_consumed_ml, 0) AS water_ml
      FROM users u JOIN user_settings s ON s.user_id = u.id
      JOIN user_profiles p ON p.user_id = u.id
      LEFT JOIN daily_logs l ON l.user_id = u.id AND l.log_date = $1::date
      WHERE u.status = 'ACTIVE'`,
      [date],
    );
    let sent = 0;
    for (const row of rows) {
      const kinds: string[] = [];
      const custom = await this.users.query<{ type: string }[]>(
        `SELECT type FROM user_reminders WHERE user_id = $1
        AND enabled = true AND type IN ('WATER', 'MEAL')`,
        [row.id],
      );
      if (
        !custom.some((r: { type: string }) => r.type === 'WATER') &&
        row.remind_water &&
        !row.hydration_restricted &&
        waterReminderDue(
          time,
          row.water_start_time,
          row.water_end_time,
          row.water_interval_mins,
          row.water_ml,
          row.daily_water_target,
        )
      )
        kinds.push('water');
      if (
        !custom.some((r: { type: string }) => r.type === 'MEAL') &&
        row.remind_meals &&
        row.meal_times
      ) {
        for (const [meal, at] of Object.entries(row.meal_times)) {
          if (at === time) kinds.push(`meal:${meal}`);
        }
      }
      for (const kind of kinds) {
        const key = `${date}:${time}:${kind}`;
        // A unique claim avoids duplicate delivery when several instances run cron.
        const claimed = await this.users.query<{ user_id: string }[]>(
          `INSERT INTO automatic_reminder_deliveries(user_id, delivery_key)
          VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id`,
          [row.id, key],
        );
        if (!claimed.length) continue;
        try {
          await this.notifications.notify(row.id, {
            type: NotificationType.REMINDER,
            title: {
              vi: kind === 'water' ? 'Nhắc uống nước' : 'Đến giờ ăn',
              en: kind === 'water' ? 'Water reminder' : 'Meal reminder',
            },
            body: {
              vi:
                kind === 'water'
                  ? 'Bạn chưa đạt tiến độ nước hôm nay. Hãy ghi lại lượng nước đã uống.'
                  : 'Ghi lại bữa ăn để theo dõi năng lượng.',
              en:
                kind === 'water'
                  ? 'You are below today’s water progress. Log your drinks.'
                  : 'Log your meal to track your energy.',
            },
            data: { route: kind === 'water' ? '/water' : '/nutrition' },
          });
          sent++;
        } catch (error) {
          await this.users.query(
            'DELETE FROM automatic_reminder_deliveries WHERE user_id = $1 AND delivery_key = $2',
            [row.id, key],
          );
          throw error;
        }
      }
    }
    return { sent };
  }
}
