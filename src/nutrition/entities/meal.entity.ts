import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { DailyNutrition } from './daily-nutrition.entity';
import type { MealItem } from './meal-item.entity';

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACK = 'SNACK',
  PRE_WORKOUT = 'PRE_WORKOUT',
  POST_WORKOUT = 'POST_WORKOUT',
}

@Entity('meals')
export class Meal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  daily_nutrition_id!: string;

  @ManyToOne('DailyNutrition', 'meals', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'daily_nutrition_id' })
  daily_nutrition!: DailyNutrition;

  @Column({ type: 'enum', enum: MealType })
  meal_type!: MealType;

  @Column({ type: 'float', default: 0 })
  meal_kcal!: number;

  @Column({ type: 'boolean', default: true })
  is_safe!: boolean;

  @OneToMany('MealItem', 'meal', { cascade: true })
  items!: MealItem[];

  @CreateDateColumn()
  logged_at!: Date;
}
