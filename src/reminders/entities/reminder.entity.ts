import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReminderType {
  MEAL = 'MEAL',
  WATER = 'WATER',
  WORKOUT = 'WORKOUT',
  WEIGHT = 'WEIGHT',
  PROGRESS = 'PROGRESS',
}

@Entity('user_reminders')
@Index(['user_id'])
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: ReminderType })
  type!: ReminderType;

  // Giờ local dạng HH:mm. V1: server so theo giờ UTC — FE tự đổi sang UTC.
  @Column({ type: 'varchar', length: 5 })
  time!: string;

  // Ngày trong tuần 0 (CN) - 6 (T7). Rỗng = hàng ngày.
  @Column({ type: 'int', array: true, default: '{}' })
  days!: number[];

  @Column({ type: 'varchar', length: 120, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  body!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_sent_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
