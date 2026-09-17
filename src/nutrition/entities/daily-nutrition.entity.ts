import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Meal } from './meal.entity';
import { User } from '../../users/entities/user.entity';

@Entity('daily_nutritions')
@Unique(['user_id', 'date'])
export class DailyNutrition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'float', default: 0 })
  total_kcal!: number;

  @Column({ type: 'float', default: 0 })
  total_protein!: number;

  @Column({ type: 'float', default: 0 })
  total_carbs!: number;

  @Column({ type: 'float', default: 0 })
  total_fat!: number;

  @Column({ type: 'float', default: 0 })
  total_burned_kcal!: number;

  @OneToMany('Meal', 'daily_nutrition', { cascade: true })
  meals!: Meal[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
