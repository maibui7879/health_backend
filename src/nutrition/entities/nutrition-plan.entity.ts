import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PlanStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
}

@Entity('nutrition_plans')
@Index(['user_id'])
@Index(['user_id', 'status'])
export class NutritionPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'date' })
  date_from!: string;

  @Column({ type: 'date' })
  date_to!: string;

  @Column({ type: 'text', nullable: true })
  goal_summary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  goal_snapshot!: Record<string, unknown> | null;

  // Nguyên output AI (mảng ngày → bữa + buổi tập + kcal), đọc là dùng ngay.
  @Column({ type: 'jsonb' })
  items!: unknown[];

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.ACTIVE })
  status!: PlanStatus;

  // Template chia sẻ: row snapshot tách khỏi lịch của tác giả.
  @Column({ type: 'boolean', default: false })
  is_template!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cover_emoji!: string | null;

  @Column({ type: 'int', default: 0 })
  use_count!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
