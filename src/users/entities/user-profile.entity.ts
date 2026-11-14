import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user.entity';

@Entity('user_profiles')
export class UserProfile {
  @Column({ type: 'varchar', length: 8, nullable: true })
  blood_type!: string | null;

  @Column({ type: 'text', nullable: true })
  occupation!: string | null;

  @Column({ type: 'text', nullable: true })
  activity_habits!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  medical_conditions!: string[];

  @Column({ type: 'boolean', default: false })
  hydration_restricted!: boolean;

  @Column({ type: 'text', array: true, default: '{nutrition,water,workout}' })
  enabled_modules!: string[];

  @Column({ type: 'varchar', default: 'MIFFLIN_ST_JEOR' })
  bmr_formula!: string;

  @Column({ type: 'int', nullable: true })
  bmr!: number | null;

  @Column({ type: 'int', nullable: true })
  tdee!: number | null;

  @PrimaryColumn('uuid')
  user_id!: string;

  @OneToOne('User', 'profile', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 100 })
  full_name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender!: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth!: Date;

  @Column({ type: 'float', nullable: true })
  height_cm!: number;

  @Column({ type: 'float', nullable: true })
  current_weight_kg!: number;

  @Column({ type: 'varchar', nullable: true })
  avatar_url!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  goal_type!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  activity_level!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'STANDARD' })
  diet_type!: string;

  @Column({ type: 'int', nullable: true })
  daily_kcal_target!: number;

  @Column({ type: 'int', nullable: true })
  daily_water_target!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
