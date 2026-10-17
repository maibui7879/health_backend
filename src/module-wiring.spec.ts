import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PasswordResetOtp } from './auth/entities/password-reset-otp.entity';
import { RegistrationOtp } from './auth/entities/registration-otp.entity';
import { CommunityComment } from './community/entities/comment.entity';
import { Post } from './community/entities/post.entity';
import { AuthorScore } from './community/entities/author-score.entity';
import { PostView } from './community/entities/post-view.entity';
import { Reaction } from './community/entities/reaction.entity';
import { CommunityModule } from './community/community.module';
import { UserProfile } from './users/entities/user-profile.entity';
import { NutritionPlan } from './nutrition/entities/nutrition-plan.entity';
import { Workout } from './workout/entities/workout.entity';
import { Meal } from './nutrition/entities/meal.entity';
import { DailyNutrition } from './nutrition/entities/daily-nutrition.entity';
import { MealItem } from './nutrition/entities/meal-item.entity';
import { Food } from './nutrition/entities/food.entity';
import { FavoriteFood } from './nutrition/entities/favorite-food.entity';
import { FoodSubmission } from './nutrition/entities/food-submission.entity';
import { DailyLog } from './tracking/entities/daily-log.entity';
import { User } from './users/entities/user.entity';
import { UserSetting } from './users/entities/user-setting.entity';
import { UserAllergy } from './users/entities/user-allergy.entity';
import { ExerciseTemplate } from './workout/entities/exercise-template.entity';
import { WorkoutGoal } from './workout/entities/workout-goal.entity';
import { Reminder } from './reminders/entities/reminder.entity';
import { AppNotification } from './notifications/entities/notification.entity';
import { ReportCase } from './moderation/entities/report-case.entity';
import { UserTasteProfile } from './insights/entities/user-taste-profile.entity';
import { I18nModule } from './i18n/i18n.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ModerationModule } from './moderation/moderation.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { WorkoutModule } from './workout/workout.module';
import { RolesGuard } from './auth/guards/roles.guard';

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn((messages: unknown[]) => [messages]),
    sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
  })),
}));

const ENTITIES = [
  PasswordResetOtp,
  RegistrationOtp,
  CommunityComment,
  Post,
  AuthorScore,
  PostView,
  Reaction,
  UserProfile,
  NutritionPlan,
  Workout,
  Meal,
  DailyNutrition,
  MealItem,
  Food,
  FavoriteFood,
  FoodSubmission,
  DailyLog,
  User,
  UserSetting,
  UserAllergy,
  ExerciseTemplate,
  WorkoutGoal,
  Reminder,
  AppNotification,
  ReportCase,
  UserTasteProfile,
];

// Biên dịch DI graph thật (repos mock, không cần DB).
// Pass = wiring module đúng (kể cả RolesGuard trong NutritionModule),
// lỗi prod cùng chữ ký nghĩa là deploy dist cũ.
describe('Module wiring (no DB)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    // EmbeddingsService thật new Groq() ngay khi construct → thiếu key là
    // ném. Set key giả để test wiring self-contained (không cần .env).
    process.env.GROQ_API_KEY ??= 'wiring-test-key';
    let builder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        I18nModule,
        EmbeddingsModule,
        NutritionModule,
      ],
    });
    for (const entity of ENTITIES) {
      builder = builder
        .overrideProvider(getRepositoryToken(entity))
        .useValue({});
    }
    module = await builder.compile();
  }, 60000);

  afterAll(async () => {
    await module?.close();
  });

  it('RolesGuard resolve được trong NutritionModule', () => {
    expect(module.get(RolesGuard, { strict: false })).toBeDefined();
  });
});
