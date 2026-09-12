import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { DailyLog } from './entities/daily-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyLog])],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
