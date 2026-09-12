import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MealItem } from './meal-item.entity';

@Entity('meals')
export class Meal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column({ type: 'date' })
  log_date!: Date;

  @Column({ type: 'varchar', length: 50 })
  meal_type!: string;

  @Column({ type: 'varchar', nullable: true })
  ai_image_url!: string;

  @Column({ type: 'int', default: 0 })
  total_meal_kcal!: number;

  @OneToMany(() => MealItem, (item) => item.meal, { cascade: true })
  items!: MealItem[];

  @CreateDateColumn()
  created_at!: Date;
}
