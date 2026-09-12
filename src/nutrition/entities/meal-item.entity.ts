import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meal } from './meal.entity';

@Entity('meal_items')
export class MealItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  meal_id!: string;

  @ManyToOne(() => Meal, (meal) => meal.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meal_id' })
  meal!: Meal;

  @Column({ type: 'varchar' })
  food_name!: string;

  @Column({ type: 'varchar', nullable: true })
  dictionary_code!: string;

  @Column({ type: 'float', default: 0 })
  quantity_grams!: number;

  @Column({ type: 'float', default: 0 })
  kcal!: number;

  @Column('text', { array: true, default: [] })
  detected_allergens!: string[];
}
