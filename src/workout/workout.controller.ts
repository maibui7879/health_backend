import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import type { FileFilterCallback } from 'multer';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { t } from '../i18n/localization.service';
import { AttachMediaLinkDto } from './dto/attach-media-link.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { CreateWorkoutGoalDto } from './dto/create-workout-goal.dto';
import { ActivityType } from './entities/workout.entity';
import { ExerciseTemplatesService } from './exercise-templates.service';
import { WorkoutGoalsService } from './workout-goals.service';
import { SuggestWorkoutQueryDto } from './dto/suggest-workout-query.dto';
import { SuggestWorkoutService } from './suggest-workout.service';
import { WorkoutService } from './workout.service';

@ApiTags('Workout')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('workouts')
export class WorkoutController {
  constructor(
    private readonly workoutService: WorkoutService,
    private readonly suggestWorkoutService: SuggestWorkoutService,
    private readonly templatesService: ExerciseTemplatesService,
    private readonly goalsService: WorkoutGoalsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Ghi nhận bài tập và cộng vào DailyNutrition total_burned_kcal',
  })
  @ApiBody({ type: CreateWorkoutDto })
  @ApiResponse({
    status: 201,
    description: 'Bài tập đã được lưu và cộng calo đốt cháy vào ngày đó.',
    schema: {
      example: {
        id: 'd93d7f0a-c5c9-4f3d-bca8-70d9d6ad3d33',
        user_id: '8a8c0570-f250-4c74-82e4-0ab0b2c7c24d',
        activity_type: 'RUNNING',
        duration_minutes: 30,
        burned_kcal: 350,
        date: '2026-09-13',
        logged_at: '2026-09-13T06:00:00.000Z',
      },
    },
  })
  createWorkout(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutService.createWorkout(userId, dto);
  }

  @Get('suggest')
  @ApiOperation({
    summary:
      'Gợi ý buổi tập bằng rule (0 token): xoay nhóm cơ + tăng tải + nghỉ',
  })
  suggest(
    @CurrentUser('sub') userId: string,
    @Query() query: SuggestWorkoutQueryDto,
  ) {
    return this.suggestWorkoutService.suggest(userId, query);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Danh sách bài tập mẫu (lọc theo activity_type)' })
  @ApiQuery({ name: 'activity_type', required: false, enum: ActivityType })
  listTemplates(@Query('activity_type') activityType?: ActivityType) {
    return this.templatesService.list(activityType);
  }

  @Get('templates/:code')
  @ApiOperation({ summary: 'Chi tiết 1 bài tập mẫu' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy mẫu.' })
  getTemplate(@Param('code') code: string) {
    return this.templatesService.getByCode(code);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Streak tập riêng (current/longest/today)' })
  getStreak(@CurrentUser('sub') userId: string) {
    return this.goalsService.getStreak(userId);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Đặt mục tiêu streak (7 | 14 | 30 ngày)' })
  @ApiResponse({ status: 201, description: 'Tạo mục tiêu thành công.' })
  @ApiResponse({ status: 409, description: 'Đang có mục tiêu ACTIVE.' })
  createGoal(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWorkoutGoalDto,
  ) {
    return this.goalsService.createGoal(userId, dto);
  }

  @Get('goals/current')
  @ApiOperation({ summary: 'Mục tiêu đang theo' })
  @ApiResponse({ status: 404, description: 'Không có mục tiêu ACTIVE.' })
  currentGoal(@CurrentUser('sub') userId: string) {
    return this.goalsService.currentGoal(userId);
  }

  @Get('goals')
  @ApiOperation({ summary: 'Lịch sử mục tiêu + badge đã nhận' })
  listGoals(@CurrentUser('sub') userId: string) {
    return this.goalsService.listGoals(userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bài tập của ngày' })
  @ApiQuery({
    name: 'date',
    required: true,
    example: '2026-09-13',
    description: 'Ngày cần lấy danh sách bài tập, định dạng YYYY-MM-DD',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách các bài tập trong ngày.',
    schema: {
      example: [
        {
          id: 'd93d7f0a-c5c9-4f3d-bca8-70d9d6ad3d33',
          user_id: '8a8c0570-f250-4c74-82e4-0ab0b2c7c24d',
          activity_type: 'RUNNING',
          duration_minutes: 30,
          burned_kcal: 350,
          date: '2026-09-13',
          logged_at: '2026-09-13T06:00:00.000Z',
        },
      ],
    },
  })
  getWorkouts(@CurrentUser('sub') userId: string, @Query('date') date: string) {
    // Bắt buộc có date: thiếu thì 400 thay vì để TypeORM ném 500 với where date=undefined
    if (!date) {
      throw new BadRequestException(t('workout.dateRequired'));
    }
    return this.workoutService.getWorkoutsByDate(userId, date);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa bài tập và trừ ngược burned_kcal khỏi DailyNutrition',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã xóa bài tập và cập nhật lại Calo đốt cháy.',
    schema: {
      example: {
        message: 'Đã xóa bài tập và cập nhật lại Calo đốt cháy',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài tập.' })
  deleteWorkout(
    @CurrentUser('sub') userId: string,
    @Param('id') workoutId: string,
  ) {
    return this.workoutService.deleteWorkout(userId, workoutId);
  }

  @Post(':id/media')
  @ApiOperation({
    summary: 'Upload ảnh/video minh họa cho bài tập (jpg/png/webp/mp4/webm)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Gắn media thành công.' })
  @ApiResponse({ status: 400, description: 'File không hợp lệ.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài tập.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(
            process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
            'workouts',
          );
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const params = req.params as unknown;
          let id = 'unknown';
          if (typeof params === 'object' && params !== null && 'id' in params) {
            const raw: unknown = params.id;
            if (typeof raw === 'string' && raw) id = raw;
          }
          cb(null, `${id}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (
        _request: Express.Request,
        file: Express.Multer.File,
        callback: FileFilterCallback,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|mp4|webm)$/i)) {
          return callback(new Error(t('workout.mediaTypeOnly')));
        }
        callback(null, true);
      },
    }),
  )
  async uploadMedia(
    @CurrentUser('sub') userId: string,
    @Param('id') workoutId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(t('workout.mediaRequired'));
    }
    const kind = file.mimetype.startsWith('image/') ? 'image' : 'video';
    return this.workoutService.attachMedia(
      userId,
      workoutId,
      file.filename,
      kind,
    );
  }

  @Post(':id/media-link')
  @ApiOperation({ summary: 'Gắn link video ngoài (YouTube) cho bài tập' })
  @ApiResponse({ status: 201, description: 'Gắn link thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài tập.' })
  attachMediaLink(
    @CurrentUser('sub') userId: string,
    @Param('id') workoutId: string,
    @Body() dto: AttachMediaLinkDto,
  ) {
    return this.workoutService.attachMediaLink(
      userId,
      workoutId,
      dto.media_url,
    );
  }

  @Post(':id/viewed')
  @ApiOperation({ summary: 'Báo đã xem hết media (tính streak)' })
  @ApiResponse({ status: 200, description: 'Đã ghi nhận lượt xem.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài tập/media.' })
  markViewed(
    @CurrentUser('sub') userId: string,
    @Param('id') workoutId: string,
  ) {
    return this.workoutService.markViewed(userId, workoutId);
  }
}
