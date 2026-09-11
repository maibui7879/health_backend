import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserAllergy } from './user-allergy.entity';
import { UserProfile } from './user-profile.entity';
import { UserSetting } from './user-setting.entity';

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  password_hash!: string;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  auth_provider!: AuthProvider;

  @Column({ type: 'varchar', nullable: true })
  device_token!: string;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @OneToOne(() => UserProfile, (profile) => profile.user, { cascade: true })
  profile!: UserProfile;

  @OneToOne(() => UserSetting, (setting) => setting.user, { cascade: true })
  setting!: UserSetting;

  @OneToMany(() => UserAllergy, (allergy) => allergy.user, { cascade: true })
  allergies!: UserAllergy[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}