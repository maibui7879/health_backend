import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_settings')
export class UserSetting {
  @PrimaryColumn('uuid')
  user_id!: string;

  @OneToOne(() => User, (user) => user.setting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'boolean', default: true })
  remind_water!: boolean;

  @Column({ type: 'int', default: 120 })
  water_interval_mins!: number;

  @Column({ type: 'boolean', default: true })
  remind_meals!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  meal_times!: any;

  @UpdateDateColumn()
  updated_at!: Date;
}