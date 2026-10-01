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

export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
}

@Entity('community_reports')
@Unique(['post_id', 'reporter_id'])
@Index(['post_id'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  post_id!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @Column('uuid')
  reporter_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @Column({ type: 'varchar', length: 20, default: ReportStatus.PENDING })
  status!: ReportStatus;

  @CreateDateColumn()
  created_at!: Date;
}
