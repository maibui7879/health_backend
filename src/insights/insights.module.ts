import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from '../nutrition/entities/food.entity';
import { UserTasteProfile } from './entities/user-taste-profile.entity';
import { InsightsService } from './insights.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserTasteProfile, Food])],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
