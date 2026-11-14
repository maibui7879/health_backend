import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';
import { DailyLog } from './entities/daily-log.entity';
import { LocalizationService } from '../i18n/localization.service';
import { UsersService } from '../users/users.service';
import { localDate, dateRange } from '../common/local-date';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(DailyLog)
    private readonly dailyLogRepo: Repository<DailyLog>,
    private readonly usersService: UsersService,
    private readonly i18n: LocalizationService,
  ) {}

  async createDailyLog(userId: string, dto: CreateDailyLogDto) {
    dateRange(dto.log_date, dto.log_date);
    if (dto.log_date > localDate())
      throw new BadRequestException('Không ghi nhật ký cho ngày tương lai.');
    const me = await this.usersService.getMe(userId);
    const target = me.profile?.daily_water_target;
    const isStreakDay = !!target && dto.water_consumed_ml >= target;

    const existing = await this.dailyLogRepo.findOne({
      where: { user_id: userId, log_date: dto.log_date },
    });

    if (existing) {
      Object.assign(existing, dto, {
        is_streak_day: isStreakDay,
        water_target_ml: existing.water_target_ml ?? target,
      });
      const savedLog = await this.dailyLogRepo.save(existing);

      if (dto.weight_log !== undefined && dto.log_date === localDate()) {
        await this.usersService.updateProfile(userId, {
          current_weight_kg: dto.weight_log,
        });
      }

      return {
        ...savedLog,
        ...(await this.canonicalCalories(userId, dto.log_date)),
      };
    }

    const log = this.dailyLogRepo.create({
      user_id: userId,
      log_date: dto.log_date,
      water_consumed_ml: dto.water_consumed_ml,
      total_kcal_in: dto.total_kcal_in,
      total_kcal_out: dto.total_kcal_out,
      ...(dto.weight_log !== undefined ? { weight_log: dto.weight_log } : {}),
      is_streak_day: isStreakDay,
    });

    const savedLog = await this.dailyLogRepo.save(log);

    if (dto.weight_log !== undefined && dto.log_date === localDate()) {
      await this.usersService.updateProfile(userId, {
        current_weight_kg: dto.weight_log,
      });
    }

    return {
      ...savedLog,
      ...(await this.canonicalCalories(userId, dto.log_date)),
    };
  }

  async getDailyLog(userId: string, date: string) {
    if (!date) {
      throw new BadRequestException(this.i18n.t('tracking.dateRequired'));
    }
    dateRange(date, date);

    const log = await this.dailyLogRepo.findOne({
      where: { user_id: userId, log_date: date },
    });

    if (!log) {
      return {
        user_id: userId,
        log_date: date,
        water_consumed_ml: 0,
        ...(await this.canonicalCalories(userId, date)),
        weight_log: null,
        is_streak_day: false,
      };
    }

    return { ...log, ...(await this.canonicalCalories(userId, date)) };
  }

  async updateDailyLog(userId: string, logId: string, dto: UpdateDailyLogDto) {
    const log = await this.dailyLogRepo.findOne({
      where: { id: logId, user_id: userId },
    });

    if (!log) {
      throw new NotFoundException(this.i18n.t('tracking.logNotFound'));
    }

    if (dto.log_date !== undefined && dto.log_date !== log.log_date) {
      throw new BadRequestException(
        'Không đổi ngày bản ghi; hãy tạo bản ghi cho ngày mới.',
      );
    }
    Object.assign(
      log,
      Object.fromEntries(
        Object.entries(dto).filter(([, value]) => value !== undefined),
      ),
    );
    const savedLog = await this.dailyLogRepo.save(log);

    if (dto.weight_log !== undefined && log.log_date === localDate()) {
      await this.usersService.updateProfile(userId, {
        current_weight_kg: dto.weight_log,
      });
    }

    return {
      ...savedLog,
      ...(await this.canonicalCalories(userId, log.log_date)),
    };
  }

  async deleteDailyLog(userId: string, logId: string) {
    const log = await this.dailyLogRepo.findOne({
      where: { id: logId, user_id: userId },
    });

    if (!log) {
      throw new NotFoundException(this.i18n.t('tracking.logNotFound'));
    }

    await this.dailyLogRepo.remove(log);

    return { message: this.i18n.t('tracking.logDeleted') };
  }

  private async canonicalCalories(userId: string, date: string) {
    const rows = await this.dailyLogRepo.query<
      {
        total_kcal_in: number;
        total_kcal_out: number;
        is_streak_day?: boolean;
        water_target_ml?: number | null;
      }[]
    >(
      `SELECT COALESCE(n.total_kcal, 0) AS total_kcal_in,
      COALESCE(n.total_burned_kcal, 0) AS total_kcal_out,
      COALESCE(l.is_streak_day, false) AS is_streak_day, l.water_target_ml
      FROM (SELECT 1) anchor
      LEFT JOIN daily_nutritions n ON n.user_id = $1 AND n.date = $2
      LEFT JOIN daily_logs l ON l.user_id = $1 AND l.log_date = $2`,
      [userId, date],
    );
    return rows[0] ?? { total_kcal_in: 0, total_kcal_out: 0 };
  }
}
