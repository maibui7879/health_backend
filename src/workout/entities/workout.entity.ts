import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExerciseTemplate } from './exercise-template.entity';

export enum ActivityType {
  RUNNING = 'RUNNING',
  CYCLING = 'CYCLING',
  WEIGHT_LIFTING = 'WEIGHT_LIFTING',
  YOGA = 'YOGA',
  SWIMMING = 'SWIMMING',
  CARDIO = 'CARDIO',
}

@Entity('workouts')
export class Workout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: ActivityType })
  activity_type!: ActivityType;

  @Column({ type: 'int' })
  duration_minutes!: number;

  @Column({ type: 'float' })
  burned_kcal!: number;

  @Column({ type: 'date' })
  date!: string;

  // Media minh họa (Phase 5A): file upload hoặc link ngoài (YouTube).
  // media_type: 'image' | 'video' | 'youtube'. media_viewed_at do FE báo
  // khi xem hết — đầu vào cho streak (5C).
  @Column({ type: 'varchar', length: 500, nullable: true })
  media_url!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  media_type!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  media_viewed_at!: Date | null;

  // Template mẫu đã chọn lúc log (nullable — log custom thì null).
  @Column({ type: 'uuid', nullable: true })
  template_id!: string | null;

  @ManyToOne(() => ExerciseTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template!: ExerciseTemplate | null;

  @CreateDateColumn()
  logged_at!: Date;
}
