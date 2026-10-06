import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommunityComment } from '../community/entities/comment.entity';
import { Post } from '../community/entities/post.entity';
import { Food } from '../nutrition/entities/food.entity';
import { User } from '../users/entities/user.entity';
import { ExerciseTemplate } from '../workout/entities/exercise-template.entity';
import { Workout } from '../workout/entities/workout.entity';
import { AdminReportsController } from './admin-reports.controller';
import { ReportCase } from './entities/report-case.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportCase,
      Post,
      CommunityComment,
      User,
      Workout,
      ExerciseTemplate,
      Food,
    ]),
    AuthModule,
  ],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ModerationModule {}
