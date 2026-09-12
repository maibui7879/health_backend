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
  @PrimaryColumn('uuid')
  user_id!: string;

  @OneToOne(() => require('./user.entity').User, (user) => user.profile, {
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

  @Column({ type: 'int', nullable: true })
  daily_kcal_target!: number;

  @Column({ type: 'int', nullable: true })
  daily_water_target!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
