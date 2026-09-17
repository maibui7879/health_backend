import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { WorkoutService } from './workout.service';

@ApiTags('Workout')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('workouts')
export class WorkoutController {
  constructor(private readonly workoutService: WorkoutService) {}

  @Post()
  @ApiOperation({ summary: 'Ghi nhận bài tập và cộng vào DailyNutrition total_burned_kcal' })
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
    return this.workoutService.getWorkoutsByDate(userId, date);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa bài tập và trừ ngược burned_kcal khỏi DailyNutrition' })
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
  deleteWorkout(@CurrentUser('sub') userId: string, @Param('id') workoutId: string) {
    return this.workoutService.deleteWorkout(userId, workoutId);
  }
}
