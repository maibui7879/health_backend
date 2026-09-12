import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserAllergy } from './entities/user-allergy.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserSetting } from './entities/user-setting.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, UserSetting, UserAllergy]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
