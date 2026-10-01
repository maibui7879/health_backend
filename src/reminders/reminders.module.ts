import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushService } from '../common/push/push.service';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import { Reminder } from './entities/reminder.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder, User, UserSetting])],
  controllers: [RemindersController],
  providers: [RemindersService, PushService],
  exports: [RemindersService],
})
export class RemindersModule {}
