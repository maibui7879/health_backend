import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportTarget {
  POST = 'POST',
  COMMENT = 'COMMENT',
  USER = 'USER',
  WORKOUT = 'WORKOUT',
  EXERCISE_TEMPLATE = 'EXERCISE_TEMPLATE',
  FOOD = 'FOOD',
}

export enum ReportCategory {
  SPAM = 'SPAM',
  INAPPROPRIATE = 'INAPPROPRIATE',
  MISINFORMATION = 'MISINFORMATION',
  HARASSMENT = 'HARASSMENT',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  ACTIONED = 'ACTIONED',
  DISMISSED = 'DISMISSED',
}

export enum ReportDecision {
  DISMISS = 'DISMISS',
  HIDE_POST = 'HIDE_POST',
  UNHIDE_POST = 'UNHIDE_POST',
  DELETE_COMMENT = 'DELETE_COMMENT',
  BAN_USER = 'BAN_USER',
  UNBAN_USER = 'UNBAN_USER',
  DEACTIVATE_TEMPLATE = 'DEACTIVATE_TEMPLATE',
}

// Report kiểm duyệt chung: bài/comment/toxic-user/tập sai/catalog.
// 1 reporter chỉ report 1 target 1 lần (chống spam).
@Entity('reports')
export class ReportCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  reporter_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ type: 'varchar', length: 20 })
  target_type!: ReportTarget;

  @Column('uuid')
  target_id!: string;

  @Column({ type: 'varchar', length: 20, default: ReportCategory.OTHER })
  category!: ReportCategory;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details!: string | null;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status!: ReportStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  action_taken!: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewer_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;
}
