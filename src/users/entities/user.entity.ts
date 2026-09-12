import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserAllergy } from './user-allergy.entity';
import type { UserProfile } from './user-profile.entity';
import type { UserSetting } from './user-setting.entity';

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

  @OneToOne(
    () => require('./user-profile.entity').UserProfile,
    (profile) => profile.user,
    { cascade: true },
  )
  profile!: UserProfile;

  @OneToOne(
    () => require('./user-setting.entity').UserSetting,
    (setting) => setting.user,
    { cascade: true },
  )
  setting!: UserSetting;

  @OneToMany(
    () => require('./user-allergy.entity').UserAllergy,
    (allergy) => allergy.user,
    { cascade: true },
  )
  allergies!: UserAllergy[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
