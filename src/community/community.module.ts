import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meal } from '../nutrition/entities/meal.entity';
import { NutritionPlan } from '../nutrition/entities/nutrition-plan.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Workout } from '../workout/entities/workout.entity';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityComment } from './entities/comment.entity';
import { Post } from './entities/post.entity';
import { Reaction } from './entities/reaction.entity';
import { Report } from './entities/report.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      CommunityComment,
      Reaction,
      Report,
      UserProfile,
      NutritionPlan,
      Workout,
      Meal,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
