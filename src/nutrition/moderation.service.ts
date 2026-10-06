import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { Food } from './entities/food.entity';
import {
  FoodSubmission,
  SubmissionStatus,
} from './entities/food-submission.entity';
import { SubmitFoodDto } from './dto/submit-food.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(FoodSubmission)
    private readonly submissionRepo: Repository<FoodSubmission>,
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(userId: string, dto: SubmitFoodDto) {
    const submission = this.submissionRepo.create({
      user_id: userId,
      food_name_vi: dto.food_name_vi.trim(),
      food_name_en: dto.food_name_en?.trim() || null,
      kcal_100g: dto.kcal_100g ?? 0,
      protein_100g: dto.protein_100g ?? 0,
      carbs_100g: dto.carbs_100g ?? 0,
      fat_100g: dto.fat_100g ?? 0,
      image_url: dto.image_url ?? null,
      note: dto.note?.trim() || null,
      status: SubmissionStatus.PENDING,
    });
    const saved = await this.submissionRepo.save(submission);
    return { message: this.i18n.t('foods.submitted'), submission: saved };
  }

  mySubmissions(userId: string) {
    return this.submissionRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  pendingList() {
    return this.submissionRepo.find({
      where: { status: SubmissionStatus.PENDING },
      order: { created_at: 'ASC' },
    });
  }

  private async mustPending(id: string) {
    const submission = await this.submissionRepo.findOne({ where: { id } });
    if (!submission || submission.status !== SubmissionStatus.PENDING) {
      throw new NotFoundException(this.i18n.t('foods.submissionNotFound'));
    }
    return submission;
  }

  // Duyệt: sinh row foods mới (code USER-*, source 'user'). Tên đã tồn tại
  // trong catalog thì báo conflict để admin reject trùng thay vì đè.
  async approve(adminId: string, id: string) {
    const submission = await this.mustPending(id);
    const exists = await this.foodRepo.findOne({
      where: { food_name_vi: submission.food_name_vi },
    });
    if (exists) {
      throw new ConflictException(this.i18n.t('foods.exists'));
    }
    const food = this.foodRepo.create({
      code: `USER-${submission.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      food_name_vi: submission.food_name_vi,
      food_name_en: submission.food_name_en,
      kcal_100g: submission.kcal_100g,
      protein_100g: submission.protein_100g,
      carbs_100g: submission.carbs_100g,
      fat_100g: submission.fat_100g,
      source: 'user',
      image_url: submission.image_url,
    });
    const saved = await this.foodRepo.save(food);
    submission.status = SubmissionStatus.APPROVED;
    submission.reviewer_id = adminId;
    submission.reviewed_at = new Date();
    await this.submissionRepo.save(submission);
    void this.notifications
      .notify(submission.user_id, {
        type: NotificationType.SUBMISSION_APPROVED,
        title: { vi: 'Món bạn gửi đã được duyệt', en: 'Your dish was approved' },
        body: {
          vi: `${submission.food_name_vi} đã vào catalog chung.`,
          en: `${submission.food_name_vi} is now in the catalog.`,
        },
        data: { route: '/foods', food_id: saved.id },
      })
      .catch(() => undefined);
    return { message: this.i18n.t('foods.approved'), food: saved };
  }

  async reject(adminId: string, id: string) {
    const submission = await this.mustPending(id);
    submission.status = SubmissionStatus.REJECTED;
    submission.reviewer_id = adminId;
    submission.reviewed_at = new Date();
    await this.submissionRepo.save(submission);
    void this.notifications
      .notify(submission.user_id, {
        type: NotificationType.SUBMISSION_REJECTED,
        title: { vi: 'Món bạn gửi chưa được duyệt', en: 'Your dish was not approved' },
        body: {
          vi: `${submission.food_name_vi} chưa đạt, bạn có thể gửi lại bản khác.`,
          en: `${submission.food_name_vi} did not pass, feel free to resubmit.`,
        },
      })
      .catch(() => undefined);
    return { message: this.i18n.t('foods.rejected') };
  }
}
