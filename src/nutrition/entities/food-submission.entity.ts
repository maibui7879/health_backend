import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Món user gửi chờ duyệt (food moderation). APPROVED -> sinh row foods mới
// (code 'USER-<8 ký tự id>', source 'user'). Lịch sử giữ lại để đối chiếu.
@Entity('food_submissions')
export class FoodSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  user_id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  food_name_vi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  food_name_en!: string | null;

  @Column({ type: 'float', default: 0 })
  kcal_100g!: number;

  @Column({ type: 'float', default: 0 })
  protein_100g!: number;

  @Column({ type: 'float', default: 0 })
  carbs_100g!: number;

  @Column({ type: 'float', default: 0 })
  fat_100g!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @Column({
    type: 'enum',
    enum: SubmissionStatus,
    default: SubmissionStatus.PENDING,
  })
  status!: SubmissionStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewer_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at!: Date | null;

  @CreateDateColumn()
  created_at!: Date;
}
