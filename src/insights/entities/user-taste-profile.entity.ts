import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_taste_profiles')
export class UserTasteProfile {
  @PrimaryColumn('uuid')
  user_id!: string;

  // tag -> điểm tích lũy (VD {"phở": 12, "gà": 9}). Cron đêm decay + tỉa.
  @Column({ type: 'jsonb', default: {} })
  liked_tags!: Record<string, number>;

  @Column({ type: 'jsonb', default: {} })
  disliked_tags!: Record<string, number>;

  // activity_type -> số lần tập (VD {"RUNNING": 7}).
  @Column({ type: 'jsonb', default: {} })
  workout_prefs!: Record<string, number>;

  // Tổng số tín hiệu đã ghi — dùng tính taste weight (cold start).
  @Column({ type: 'int', default: 0 })
  interactions!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
