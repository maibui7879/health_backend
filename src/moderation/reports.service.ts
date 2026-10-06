import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CommunityComment } from '../community/entities/comment.entity';
import { Post } from '../community/entities/post.entity';
import { LocalizationService } from '../i18n/localization.service';
import { Food } from '../nutrition/entities/food.entity';
import { User } from '../users/entities/user.entity';
import { ExerciseTemplate } from '../workout/entities/exercise-template.entity';
import { Workout } from '../workout/entities/workout.entity';
import { ReviewReportDto, SubmitReportDto } from './dto/report.dto';
import {
  ReportCase,
  ReportDecision,
  ReportStatus,
  ReportTarget,
} from './entities/report-case.entity';

// Đếm report còn hiệu lực để tự ẩn (loại DISMISSED).
const AUTO_HIDE_REPORTS = 3;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportCase)
    private readonly reportRepo: Repository<ReportCase>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(CommunityComment)
    private readonly commentRepo: Repository<CommunityComment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workout)
    private readonly workoutRepo: Repository<Workout>,
    @InjectRepository(ExerciseTemplate)
    private readonly templateRepo: Repository<ExerciseTemplate>,
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
  ) {}

  // Gửi report mọi loại target. Trả case + ownerId (để caller check self).
  async fileReport(reporterId: string, dto: SubmitReportDto) {
    const ownerId = await this.resolveOwner(dto.target_type, dto.target_id);
    if (ownerId && ownerId === reporterId) {
      throw new BadRequestException(this.i18n.t('reports.reportSelf'));
    }
    const dup = await this.reportRepo.findOne({
      where: {
        reporter_id: reporterId,
        target_type: dto.target_type,
        target_id: dto.target_id,
      },
    });
    if (dup) {
      throw new ConflictException(this.i18n.t('reports.reportExists'));
    }
    const saved = await this.reportRepo.save(
      this.reportRepo.create({
        reporter_id: reporterId,
        target_type: dto.target_type,
        target_id: dto.target_id,
        category: dto.category,
        details: dto.details?.trim() || null,
        status: ReportStatus.PENDING,
      }),
    );
    return {
      message: this.i18n.t('reports.submitted'),
      report: saved,
      ownerId,
    };
  }

  // Đếm report hiệu lực của 1 target (tự ẩn bài khi đủ 3).
  async activeCount(targetType: ReportTarget, targetId: string) {
    return this.reportRepo.count({
      where: {
        target_type: targetType,
        target_id: targetId,
        status: In([ReportStatus.PENDING, ReportStatus.ACTIONED]),
      },
    });
  }

  myReports(reporterId: string) {
    return this.reportRepo.find({
      where: { reporter_id: reporterId },
      order: { created_at: 'DESC' },
    });
  }

  pendingList(targetType?: ReportTarget) {
    return this.reportRepo.find({
      where: {
        status: ReportStatus.PENDING,
        ...(targetType ? { target_type: targetType } : {}),
      },
      order: { created_at: 'ASC' },
    });
  }

  // Admin chốt: DISMISS hoặc action theo loại target (sai loại → 400).
  async review(reviewerId: string, id: string, dto: ReviewReportDto) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report || report.status !== ReportStatus.PENDING) {
      throw new NotFoundException(this.i18n.t('reports.notFound'));
    }
    if (dto.decision === ReportDecision.DISMISS) {
      report.status = ReportStatus.DISMISSED;
      report.action_taken = ReportDecision.DISMISS;
    } else {
      await this.applyAction(report.target_type, report.target_id, dto.decision);
      report.status = ReportStatus.ACTIONED;
      report.action_taken = dto.decision;
    }
    report.reviewer_id = reviewerId;
    report.reviewed_at = new Date();
    return this.reportRepo.save(report);
  }

  private async applyAction(
    targetType: ReportTarget,
    targetId: string,
    decision: ReportDecision,
  ) {
    const bad = () =>
      new BadRequestException(this.i18n.t('reports.actionMismatch'));
    switch (decision) {
      case ReportDecision.HIDE_POST:
      case ReportDecision.UNHIDE_POST: {
        if (targetType !== ReportTarget.POST) throw bad();
        const post = await this.postRepo.findOne({ where: { id: targetId } });
        if (!post) throw new NotFoundException(this.i18n.t('community.postNotFound'));
        post.is_hidden = decision === ReportDecision.HIDE_POST;
        await this.postRepo.save(post);
        return;
      }
      case ReportDecision.DELETE_COMMENT: {
        if (targetType !== ReportTarget.COMMENT) throw bad();
        const comment = await this.commentRepo.findOne({ where: { id: targetId } });
        if (!comment) throw new NotFoundException(this.i18n.t('community.commentNotFound'));
        await this.commentRepo.remove(comment);
        return;
      }
      case ReportDecision.BAN_USER:
      case ReportDecision.UNBAN_USER: {
        if (targetType !== ReportTarget.USER) throw bad();
        const user = await this.userRepo.findOne({ where: { id: targetId } });
        if (!user) throw new NotFoundException(this.i18n.t('users.notFound'));
        user.status = decision === ReportDecision.BAN_USER ? 'BANNED' : 'ACTIVE';
        await this.userRepo.save(user);
        return;
      }
      case ReportDecision.DEACTIVATE_TEMPLATE: {
        if (targetType !== ReportTarget.EXERCISE_TEMPLATE) throw bad();
        const template = await this.templateRepo.findOne({ where: { id: targetId } });
        if (!template) throw new NotFoundException(this.i18n.t('workout.templateNotFound'));
        template.is_active = false;
        await this.templateRepo.save(template);
        return;
      }
      default:
        throw bad();
    }
  }

  // Trả ownerId để check self-report (target không owner → null).
  // Đồng thời 404 khi target không tồn tại. Không để lộ nội dung ẩn ở đây —
  // caller (feed/detail) tự áp quy tắc hiển thị của nó.
  private async resolveOwner(
    targetType: ReportTarget,
    targetId: string,
  ): Promise<string | null> {
    switch (targetType) {
      case ReportTarget.POST: {
        const post = await this.postRepo.findOne({ where: { id: targetId } });
        if (!post) throw new NotFoundException(this.i18n.t('community.postNotFound'));
        return post.user_id;
      }
      case ReportTarget.COMMENT: {
        const comment = await this.commentRepo.findOne({ where: { id: targetId } });
        if (!comment) throw new NotFoundException(this.i18n.t('community.commentNotFound'));
        return comment.user_id;
      }
      case ReportTarget.USER: {
        const user = await this.userRepo.findOne({ where: { id: targetId } });
        if (!user) throw new NotFoundException(this.i18n.t('users.notFound'));
        return user.id;
      }
      case ReportTarget.WORKOUT: {
        const workout = await this.workoutRepo.findOne({ where: { id: targetId } });
        if (!workout) throw new NotFoundException(this.i18n.t('workout.notFound'));
        return null;
      }
      case ReportTarget.EXERCISE_TEMPLATE: {
        const template = await this.templateRepo.findOne({ where: { id: targetId } });
        if (!template) throw new NotFoundException(this.i18n.t('workout.templateNotFound'));
        return null;
      }
      case ReportTarget.FOOD: {
        const food = await this.foodRepo.findOne({ where: { id: targetId } });
        if (!food) throw new NotFoundException(this.i18n.t('foods.notFound'));
        return null;
      }
      default:
        throw new BadRequestException(this.i18n.t('reports.invalidTarget'));
    }
  }
}
