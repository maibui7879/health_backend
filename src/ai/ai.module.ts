import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NutritionModule } from '../nutrition/nutrition.module';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { UsersModule } from '../users/users.module';
import { Workout } from '../workout/entities/workout.entity';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    NutritionModule,
    TypeOrmModule.forFeature([AiConversation, AiMessage, DailyLog, Workout]),
  ],
  controllers: [AiController, AiChatController],
  providers: [AiService, AiChatService],
  exports: [AiService, AiChatService],
})
export class AiModule {}
