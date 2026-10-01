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

export enum LinkedType {
  NUTRITION_PLAN = 'NUTRITION_PLAN',
  WORKOUT = 'WORKOUT',
  MEAL = 'MEAL',
}

@Entity('community_posts')
@Index(['is_hidden', 'created_at'])
@Index(['user_id', 'created_at'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url!: string | null;

  // Link thực đơn / buổi tập / bữa ăn kèm bài đăng (snapshot lúc đăng để
  // không lộ dữ liệu private ngoài ý tác giả).
  @Column({ type: 'varchar', length: 20, nullable: true })
  linked_type!: LinkedType | null;

  @Column({ type: 'uuid', nullable: true })
  linked_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  linked_snapshot!: Record<string, unknown> | null;

  // Kiểm duyệt: true = ẩn khỏi feed (đủ report hoặc vi phạm).
  @Column({ type: 'boolean', default: false })
  is_hidden!: boolean;

  @Column({ type: 'int', default: 0 })
  like_count!: number;

  @Column({ type: 'int', default: 0 })
  comment_count!: number;

  @Column({ type: 'int', default: 0 })
  report_count!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
