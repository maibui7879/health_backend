import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Meal } from './meal.entity';

@Entity('meal_items')
export class MealItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  meal_id!: string;

  @ManyToOne('Meal', 'items', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meal_id' })
  meal!: Meal;

  @Column({ type: 'varchar', length: 255 })
  food_name_vi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  food_name_en!: string;

  @Column({ type: 'float', default: 0 })
  estimated_kcal!: number;

  @Column({ type: 'boolean', default: false })
  is_allergen!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[];
}
