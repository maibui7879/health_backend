import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

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

  @CreateDateColumn()
  logged_at!: Date;
}
