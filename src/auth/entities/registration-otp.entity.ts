import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('registration_otps')
@Index(['email'])
export class RegistrationOtp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ length: 100 })
  full_name!: string;

  // Mật khẩu đã hash — user thật chỉ tạo khi verify OTP thành công.
  @Column({ length: 255 })
  password_hash!: string;

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
