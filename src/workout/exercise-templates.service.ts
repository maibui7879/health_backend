import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { ActivityType } from './entities/workout.entity';
import { ExerciseTemplate } from './entities/exercise-template.entity';

@Injectable()
export class ExerciseTemplatesService {
  constructor(
    @InjectRepository(ExerciseTemplate)
    private readonly templateRepo: Repository<ExerciseTemplate>,
    private readonly i18n: LocalizationService,
  ) {}

  list(activityType?: ActivityType) {
    return this.templateRepo.find({
      where: {
        is_active: true,
        ...(activityType ? { activity_type: activityType } : {}),
      },
      order: { code: 'ASC' },
    });
  }

  async getByCode(code: string) {
    const template = await this.templateRepo.findOne({ where: { code } });
    if (!template || !template.is_active) {
      throw new NotFoundException(this.i18n.t('workout.templateNotFound'));
    }
    return template;
  }

  async mustExist(id: string) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template || !template.is_active) {
      throw new NotFoundException(this.i18n.t('workout.templateNotFound'));
    }
    return template;
  }
}
