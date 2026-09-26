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

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(DailyLog)
    private readonly dailyLogRepo: Repository<DailyLog>,
    private readonly usersService: UsersService,
    private readonly i18n: LocalizationService,
  ) {}

  async createDailyLog(userId: string, dto: CreateDailyLogDto) {
    const previousDate = this.getPreviousDate(dto.log_date);
    const previousLog = await this.dailyLogRepo.findOne({
      where: { user_id: userId, log_date: previousDate },
    });
    const isStreakDay = previousLog !== null;

    const existing = await this.dailyLogRepo.findOne({
      where: { user_id: userId, log_date: dto.log_date },
    });

    if (existing) {
      Object.assign(existing, dto, { is_streak_day: isStreakDay });
      const savedLog = await this.dailyLogRepo.save(existing);

      if (dto.weight_log !== undefined) {
        await this.usersService.updateProfile(userId, {
          current_weight_kg: dto.weight_log,
        });
      }

      return savedLog;
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

    if (dto.weight_log !== undefined) {
      await this.usersService.updateProfile(userId, {
        current_weight_kg: dto.weight_log,
      });
    }

    return savedLog;
  }

  async getDailyLog(userId: string, date: string) {
    if (!date) {
      throw new BadRequestException(this.i18n.t('tracking.dateRequired'));
    }

    const log = await this.dailyLogRepo.findOne({
      where: { user_id: userId, log_date: date },
    });

    if (!log) {
      return {
        user_id: userId,
        log_date: date,
        water_consumed_ml: 0,
        total_kcal_in: 0,
        total_kcal_out: 0,
        weight_log: null,
        is_streak_day: false,
      };
    }

    return log;
  }

  async updateDailyLog(userId: string, logId: string, dto: UpdateDailyLogDto) {
    const log = await this.dailyLogRepo.findOne({
      where: { id: logId, user_id: userId },
    });

    if (!log) {
      throw new NotFoundException(this.i18n.t('tracking.logNotFound'));
    }

    Object.assign(log, dto);
    const savedLog = await this.dailyLogRepo.save(log);

    if (dto.weight_log !== undefined) {
      await this.usersService.updateProfile(userId, {
        current_weight_kg: dto.weight_log,
      });
    }

    return savedLog;
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

  private getPreviousDate(date: string): string {
    const previousDate = new Date(`${date}T00:00:00.000Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    return previousDate.toISOString().slice(0, 10);
  }
}
