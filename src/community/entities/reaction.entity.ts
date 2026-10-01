import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from './post.entity';

export enum ReactionType {
  LIKE = 'LIKE',
}

@Entity('community_reactions')
@Unique(['post_id', 'user_id'])
@Index(['post_id'])
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 20, default: ReactionType.LIKE })
  type!: ReactionType;

  @CreateDateColumn()
  created_at!: Date;
}
