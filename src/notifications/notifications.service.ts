import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from '../common/push/push.service';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import {
  AppNotification,
  NotificationType,
} from './entities/notification.entity';

export interface NotifyInput {
  type: NotificationType;
  title: { vi: string; en: string };
  body?: { vi: string; en: string };
  data?: Record<string, unknown>;
  /** false = chỉ lưu in-app, không bắn push (caller tự push riêng). */
  push?: boolean;
}

// Trung tâm thông báo: lưu in-app + bắn push best-effort (fire-and-forget
// từ caller — không bao giờ làm fail nghiệp vụ chính).
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(AppNotification)
    private readonly notificationRepo: Repository<AppNotification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSetting)
    private readonly settingRepo: Repository<UserSetting>,
    private readonly push: PushService,
  ) {}

  async notify(userId: string, input: NotifyInput) {
    const [user, setting] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.settingRepo.findOne({ where: { user_id: userId } }),
    ]);
    if (!user) return null;
    const vi = setting?.locale !== 'en';
    const saved = await this.notificationRepo.save(
      this.notificationRepo.create({
        user_id: userId,
        type: input.type,
        title: vi ? input.title.vi : input.title.en,
        body: input.body ? (vi ? input.body.vi : input.body.en) : null,
        data: input.data ?? null,
        is_read: false,
      }),
    );
    // Push best-effort: token chết thì dọn như reminders.
    if (input.push !== false) {
      const token = user.device_token;
      if (token && this.push.isPushToken(token)) {
        const { invalidTokens } = await this.push.sendMany([
          { to: token, title: saved.title, body: saved.body ?? '' },
        ]);
        if (invalidTokens.length > 0) {
          await this.userRepo.update(userId, { device_token: null });
        }
      }
    }
    return saved;
  }

  list(userId: string, limit = 20, offset = 0, unreadOnly = false) {
    return this.notificationRepo.find({
      where: { user_id: userId, ...(unreadOnly ? { is_read: false } : {}) },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
      skip: Math.max(offset, 0),
    });
  }

  async unreadCount(userId: string) {
    const count = await this.notificationRepo.count({
      where: { user_id: userId, is_read: false },
    });
    return { unread: count };
  }

  async markRead(userId: string, id: string) {
    const note = await this.notificationRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!note) return null;
    note.is_read = true;
    return this.notificationRepo.save(note);
  }

  async markAllRead(userId: string) {
    await this.notificationRepo
      .createQueryBuilder()
      .update()
      .set({ is_read: true })
      .where('user_id = :userId AND is_read = false', { userId })
      .execute();
    return this.unreadCount(userId);
  }
}
