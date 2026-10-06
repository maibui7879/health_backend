import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ActivityType } from './workout.entity';

export enum ExerciseDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

// Catalog bài tập mẫu (Phase 5B) — seed sẵn trước prod để FE luôn có
// media/mô tả hiển thị, AI/rule map gợi ý vào template thay vì bịa link.
// `code` là key seed bền (VD 'RUN-EASY-01'), không dùng tên để upsert.
@Entity('exercise_templates')
export class ExerciseTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  code!: string;

  // VARCHAR cho khớp DDL migration 017 (đồng thời tránh circular import
  // runtime với workout.entity — ActivityType chỉ dùng ở kiểu dữ liệu).
  @Column({ type: 'varchar', length: 20 })
  activity_type!: ActivityType;

  @Column({ type: 'varchar', length: 255 })
  name_vi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name_en!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  muscle_groups!: string[];

  @Column({ type: 'enum', enum: ExerciseDifficulty })
  difficulty!: ExerciseDifficulty;

  // Thời lượng gợi ý mặc định (phút) — log session override tự do.
  // Cùng 1 template + duration khác nhau vẫn dùng chung demo video,
  // vì media minh họa ĐỘNG TÁC, không phụ thuộc thời lượng.
  @Column({ type: 'int', nullable: true })
  default_duration_minutes!: number | null;

  // Link demo (YouTube/S3) — NULL khi chưa có, admin bổ sung sau.
  @Column({ type: 'varchar', length: 500, nullable: true })
  demo_video_url!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  cover_emoji!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;
}
