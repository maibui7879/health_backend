import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { WellnessController, LegalController } from './wellness.controller';
import { WellnessService } from './wellness.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule],
  controllers: [WellnessController, LegalController],
  providers: [WellnessService],
})
export class WellnessModule {}
