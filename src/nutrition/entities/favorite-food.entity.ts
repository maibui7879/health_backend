import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { Food } from './food.entity';

@Entity('favorite_foods')
@Index(['user_id'])
export class FavoriteFood {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne('Food', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'food_id' })
  food!: Food | null;

  @Column({ type: 'uuid', nullable: true })
  food_id!: string | null;

  // Snapshot giá trị lúc lưu — món yêu thích không đổi theo catalog.
  @Column({ type: 'varchar', length: 255 })
  food_name_vi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  food_name_en!: string | null;

  @Column({ type: 'float', default: 0 })
  kcal_100g!: number;

  @Column({ type: 'float', default: 0 })
  protein_100g!: number;

  @Column({ type: 'float', default: 0 })
  carbs_100g!: number;

  @Column({ type: 'float', default: 0 })
  fat_100g!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
