import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushService } from '../common/push/push.service';
import { User } from '../users/entities/user.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import { AppNotification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppNotification, User, UserSetting]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
