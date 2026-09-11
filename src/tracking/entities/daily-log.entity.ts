import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_logs')
@Index(['user_id', 'log_date'], { unique: true })
export class DailyLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'date' })
  log_date!: Date;

  @Column({ type: 'int', default: 0 })
  water_consumed_ml!: number;

  @Column({ type: 'int', default: 0 })
  total_kcal_in!: number;

  @Column({ type: 'int', default: 0 })
  total_kcal_out!: number;

  @Column({ type: 'float', nullable: true })
  weight_log!: number;

  @Column({ type: 'boolean', default: false })
  is_streak_day!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}