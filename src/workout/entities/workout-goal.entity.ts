import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum WorkoutGoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Mục tiêu streak tập (Phase 5C): 1 ACTIVE/user. Cron daily chốt kết quả,
// COMPLETED kèm badge 'STREAK_<target_days>'.
@Entity('workout_goals')
export class WorkoutGoal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'int' })
  target_days!: number;

  @Column({ type: 'date' })
  start_date!: string;

  @Column({ type: 'date' })
  end_date!: string;

  @Column({
    type: 'enum',
    enum: WorkoutGoalStatus,
    default: WorkoutGoalStatus.ACTIVE,
  })
  status!: WorkoutGoalStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  badge!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;
}
