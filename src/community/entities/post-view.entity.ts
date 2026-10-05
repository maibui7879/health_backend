import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from './post.entity';

// Impression ngầm: bài nào user đã thấy mấy lần, lần cuối khi nào.
// FE báo batch qua POST /community/views (chỉ tính "thấy thật" trên màn hình).
@Entity('community_post_views')
@Unique(['user_id', 'post_id'])
@Index(['user_id', 'last_seen_at'])
export class PostView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  post_id!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @Column({ type: 'int', default: 1 })
  impressions!: number;

  @CreateDateColumn()
  created_at!: Date;

  // Lần thấy gần nhất (tự cập nhật mỗi lần save).
  @UpdateDateColumn()
  last_seen_at!: Date;
}
