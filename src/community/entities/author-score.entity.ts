import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Điểm quan hệ ngầm user→author: like/comment +1, report −2 (kẹp −5..10).
// Riêng tư tuyệt đối — tác giả không biết mình bị cộng/trừ điểm.
@Entity('community_author_scores')
@Unique(['user_id', 'author_id'])
export class AuthorScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @Column('uuid')
  author_id!: string;

  @Column({ type: 'float', default: 0 })
  score!: number;

  @Column({ type: 'int', default: 0 })
  interactions!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
