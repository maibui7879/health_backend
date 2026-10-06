import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  SUBMISSION_APPROVED = 'SUBMISSION_APPROVED',
  SUBMISSION_REJECTED = 'SUBMISSION_REJECTED',
  REPORT_ACTIONED = 'REPORT_ACTIONED',
  GOAL_COMPLETED = 'GOAL_COMPLETED',
  REMINDER = 'REMINDER',
  SYSTEM = 'SYSTEM',
}

// Thông báo in-app theo sự kiện (kèm push best-effort nếu có device token).
// data: tham số FE dùng điều hướng sâu (VD {route:'/plans', plan_id}).
@Entity('notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  body!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
