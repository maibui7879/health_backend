import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Import các Module đã tạo
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrackingModule } from './tracking/tracking.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { AiModule } from './ai/ai.module';
import { WorkoutModule } from './workout/workout.module';
import { RemindersModule } from './reminders/reminders.module';

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
        synchronize: true, 
        ssl: {

          rejectUnauthorized: false,
        },
      }),
    }),

    // 3. Khai báo các Module nghiệp vụ
    AuthModule,
    UsersModule,
    TrackingModule,
    NutritionModule,
    AiModule,
    WorkoutModule,
    RemindersModule,
  ],
})
export class AppModule {}