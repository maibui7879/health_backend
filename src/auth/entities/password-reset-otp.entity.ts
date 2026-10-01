import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_reset_otps')
@Index(['email'])
export class PasswordResetOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ length: 255 })
  code_hash!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
