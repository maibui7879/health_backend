import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSetting } from '../users/entities/user-setting.entity';
import { LocalizationService } from './localization.service';
import { UserLocaleInterceptor } from './user-locale.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserSetting])],
  providers: [
    LocalizationService,
    { provide: APP_INTERCEPTOR, useClass: UserLocaleInterceptor },
  ],
  exports: [LocalizationService],
})
export class I18nModule {}
