import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Import các Module đã tạo
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrackingModule } from './tracking/tracking.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { AiModule } from './ai/ai.module';
import { CommunityModule } from './community/community.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { WorkoutModule } from './workout/workout.module';
import { RemindersModule } from './reminders/reminders.module';
import { I18nModule } from './i18n/i18n.module';
import { ModerationModule } from './moderation/moderation.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 1. Khởi tạo ConfigModule toàn cục để đọc file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),

    // 3. Khai báo các Module nghiệp vụ
    ScheduleModule.forRoot(),
    EmbeddingsModule,
    I18nModule,
    AuthModule,
    UsersModule,
    TrackingModule,
    NutritionModule,
    AiModule,
    WorkoutModule,
    RemindersModule,
    CommunityModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
