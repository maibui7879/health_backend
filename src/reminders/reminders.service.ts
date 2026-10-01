import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from '../common/push/push.service';
import { LocalizationService } from '../i18n/localization.service';
import type { TranslationKey } from '../i18n/dictionaries/vi';
import type { AppLocale } from '../i18n/locale';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import { CreateReminderDto, UpdateReminderDto } from './dto/reminder.dto';
import { Reminder, ReminderType } from './entities/reminder.entity';

const DEFAULT_TITLE: Record<ReminderType, TranslationKey> = {
  [ReminderType.MEAL]: 'reminders.defaultMealTitle',
  [ReminderType.WATER]: 'reminders.defaultWaterTitle',
  [ReminderType.WORKOUT]: 'reminders.defaultWorkoutTitle',
  [ReminderType.WEIGHT]: 'reminders.defaultWeightTitle',
  [ReminderType.PROGRESS]: 'reminders.defaultProgressTitle',
};

const DEFAULT_BODY: Record<ReminderType, TranslationKey> = {
  [ReminderType.MEAL]: 'reminders.defaultMealBody',
  [ReminderType.WATER]: 'reminders.defaultWaterBody',
  [ReminderType.WORKOUT]: 'reminders.defaultWorkoutBody',
  [ReminderType.WEIGHT]: 'reminders.defaultWeightBody',
  [ReminderType.PROGRESS]: 'reminders.defaultProgressBody',
};

// Reminder loại WATER/MEAL tôn trọng công tắc trong settings.
function isGatedBySettings(
  type: ReminderType,
  setting: Pick<UserSetting, 'remind_water' | 'remind_meals'> | null,
): boolean {
  if (!setting) return true;
  if (type === ReminderType.WATER && setting.remind_water === false) {
    return false;
  }
  if (type === ReminderType.MEAL && setting.remind_meals === false) {
    return false;
  }
  return true;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepo: Repository<Reminder>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSetting)
    private readonly settingRepo: Repository<UserSetting>,
    private readonly pushService: PushService,
    private readonly i18n: LocalizationService,
  ) {}

  async list(userId: string) {
    return this.reminderRepo.find({
      where: { user_id: userId },
      order: { time: 'ASC', created_at: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateReminderDto) {
    const reminder = this.reminderRepo.create({
      user_id: userId,
      type: dto.type,
      time: dto.time,
      days: dto.days ?? [],
      title: dto.title ?? null,
      body: dto.body ?? null,
      enabled: true,
    });
    const saved = await this.reminderRepo.save(reminder);
    return { message: this.i18n.t('reminders.created'), reminder: saved };
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    const reminder = await this.getOwned(userId, id);
    const patch: Partial<Reminder> = {};
    if (dto.time !== undefined) patch.time = dto.time;
    if (dto.days !== undefined) patch.days = dto.days;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.body !== undefined) patch.body = dto.body;
    if (dto.enabled !== undefined) patch.enabled = dto.enabled;
    Object.assign(reminder, patch);
    const saved = await this.reminderRepo.save(reminder);
    return { message: this.i18n.t('reminders.updated'), reminder: saved };
  }

  async remove(userId: string, id: string) {
    const reminder = await this.getOwned(userId, id);
    await this.reminderRepo.remove(reminder);
    return { message: this.i18n.t('reminders.deleted') };
  }

  private async getOwned(userId: string, id: string) {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder) {
      throw new NotFoundException(this.i18n.t('reminders.notFound'));
    }
    if (reminder.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('reminders.forbidden'));
    }
    return reminder;
  }

  // Chạy mỗi phút: bắn reminder đến giờ (giờ UTC — FE tự đổi sang UTC).
  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(now = new Date()) {
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const day = now.getUTCDay();
    const cutoff = new Date(now.getTime() - 90_000);

    const due = await this.reminderRepo
      .createQueryBuilder('r')
      .where('r.enabled = TRUE')
      .andWhere('r.time = :time', { time: `${hh}:${mm}` })
      .andWhere('(r.last_sent_at IS NULL OR r.last_sent_at < :cutoff)', {
        cutoff: cutoff.toISOString(),
      })
      .getMany();

    if (due.length === 0) return { sent: 0 };

    const messages: { to: string; title: string; body: string }[] = [];
    const firedIds: string[] = [];
    for (const r of due) {
      const days = r.days ?? [];
      if (days.length > 0 && !days.includes(day)) continue;
      const [user, setting] = await Promise.all([
        this.userRepo.findOne({ where: { id: r.user_id } }),
        this.settingRepo.findOne({ where: { user_id: r.user_id } }),
      ]);
      if (!isGatedBySettings(r.type, setting)) continue;
      const token = user?.device_token;
      if (!token || !this.pushService.isPushToken(token)) continue;
      const lang: AppLocale =
        setting?.locale === 'en' || setting?.locale === 'vi'
          ? setting.locale
          : 'vi';
      messages.push({
        to: token,
        title: r.title ?? this.i18n.tIn(lang, DEFAULT_TITLE[r.type]),
        body: r.body ?? this.i18n.tIn(lang, DEFAULT_BODY[r.type]),
      });
      firedIds.push(r.id);
    }

    if (messages.length === 0) return { sent: 0 };
    const { sent, invalidTokens } = await this.pushService.sendMany(messages);

    await this.reminderRepo
      .createQueryBuilder()
      .update()
      .set({ last_sent_at: () => 'now()' })
      .where('id IN (:...ids)', { ids: firedIds })
      .execute();

    if (invalidTokens.length > 0) {
      // Token chết (gỡ app) → xóa để lần sau khỏi gửi.
      await this.userRepo
        .createQueryBuilder()
        .update()
        .set({ device_token: null })
        .where('device_token IN (:...tokens)', { tokens: invalidTokens })
        .execute();
      this.logger.log(`Xóa ${invalidTokens.length} device token chết.`);
    }
    this.logger.log(`Đã bắn ${sent}/${messages.length} push nhắc nhở.`);
    return { sent };
  }
}
