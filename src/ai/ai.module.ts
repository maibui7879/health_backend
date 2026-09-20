import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NutritionModule } from '../nutrition/nutrition.module';
import { UsersModule } from '../users/users.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule, UsersModule, NutritionModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
