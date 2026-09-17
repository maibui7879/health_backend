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
import { CreateMealDto } from './dto/create-meal.dto';
import { SearchHistoryDto } from './dto/search-history.dto';
import { NutritionService } from './nutrition.service';

@ApiTags('Nutrition')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('meals')
  @ApiOperation({ summary: 'Lưu bữa ăn từ kết quả phân tích AI' })
  @ApiBody({ type: CreateMealDto })
  @ApiResponse({
    status: 201,
    description: 'Bữa ăn đã được lưu thành công.',
    schema: {
      example: {
        id: '2f8d9ae5-5d2c-4d9a-a7ca-9d98acc2ccf3',
        daily_nutrition_id: 'b0c617d3-57cc-4e2d-b1a6-64b24958f429',
        meal_type: 'LUNCH',
        meal_kcal: 620,
        is_safe: true,
        logged_at: '2026-09-12T12:15:00.000Z',
        items: [
          {
            food_name_vi: 'Cơm trắng',
            food_name_en: 'White rice',
            estimated_kcal: 300,
            is_allergen: false,
            warnings: [],
          },
        ],
      },
    },
  })
  createMeal(
    @CurrentUser('sub') userId: string,
    @Body() createMealDto: CreateMealDto,
  ) {
    return this.nutritionService.createMeal(userId, createMealDto);
  }

  @Get('daily')
  @ApiOperation({
    summary: 'Lấy tóm tắt dinh dưỡng và danh sách bữa ăn trong ngày',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-09-12',
    description: 'Định dạng YYYY-MM-DD. Mặc định là hôm nay.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin tổng calories và diary phân loại theo từng bữa ăn.',
    schema: {
      example: {
        id: 'd8c1fe1b-c633-4d82-a18d-c7e0c1627912',
        user_id: '0db6f77b-8ca6-4d62-b91d-bf785c0a86ab',
        date: '2026-09-12',
        total_kcal: 1820,
        diary: {
          BREAKFAST: [],
          LUNCH: [],
          DINNER: [],
          SNACK: [
            {
              id: 'e5a6082e-0d6c-43be-bd2f-987d71d2e753',
              meal_type: 'SNACK',
              meal_kcal: 240,
              is_safe: true,
              logged_at: '2026-09-12T10:00:00.000Z',
            },
          ],
          PRE_WORKOUT: [],
          POST_WORKOUT: [],
        },
      },
    },
  })
  getDailyDashboard(
    @CurrentUser('sub') userId: string,
    @Query('date') date?: string,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.nutritionService.getDailyDashboard(userId, targetDate);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Tìm kiếm lịch sử bữa ăn cũ (Theo ngày, tên món, buổi)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-09-01',
    description: 'Tìm từ ngày',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-09-12',
    description: 'Đến ngày',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    example: 'Phở',
    description: 'Tìm theo tên món ăn',
  })
  @ApiQuery({
    name: 'mealType',
    required: false,
    enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT'],
    example: 'LUNCH',
    description: 'Lọc theo bữa ăn',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách bữa ăn phù hợp điều kiện tìm kiếm.',
    schema: {
      example: [
        {
          meal_id: '8f68d41f-8649-4faa-a41b-ec0e1dca5c50',
          date: '2026-09-12',
          meal_type: 'LUNCH',
          meal_kcal: 540,
          is_safe: true,
          summary: 'Phở bò, Hành ngò',
          items: [
            {
              id: 'e2dd8df4-a321-4f9d-bd66-eecd89e17a3c',
              food_name_vi: 'Phở bò',
              food_name_en: 'Beef Pho',
              estimated_kcal: 420,
              is_allergen: false,
              warnings: [],
            },
          ],
        },
      ],
    },
  })
  searchHistory(
    @CurrentUser('sub') userId: string,
    @Query() query: SearchHistoryDto,
  ) {
    return this.nutritionService.searchHistory(userId, query);
  }

  @Delete('meals/:id')
  @ApiOperation({
    summary: 'Xóa một bữa ăn và trừ ngược Kcal vào tổng ngày',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã xóa bữa ăn và cập nhật lại Calories.',
    schema: {
      example: {
        message: 'Đã xóa bữa ăn và cập nhật lại Calories',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Bạn không có quyền xóa bữa ăn này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bữa ăn.' })
  deleteMeal(@CurrentUser('sub') userId: string, @Param('id') mealId: string) {
    return this.nutritionService.deleteMeal(userId, mealId);
  }

  @Get('stats/weekly')
  @ApiOperation({
    summary: 'Lấy thống kê Calo của 7 ngày gần nhất để vẽ biểu đồ Bar Chart',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách thống kê 7 ngày gần nhất.',
    schema: {
      example: [
        {
          id: '62d42d66-2737-4ab3-a9cf-0f86c7f0d7ab',
          user_id: '0db6f77b-8ca6-4d62-b91d-bf785c0a86ab',
          date: '2026-09-06',
          total_kcal: 1900,
        },
      ],
    },
  })
  getWeeklyStats(@CurrentUser('sub') userId: string) {
    return this.nutritionService.getWeeklyStats(userId);
  }

  @Get('targets')
  @ApiOperation({
    summary: 'Tính toán tỷ lệ Đạm, Đường, Béo dựa trên Chế độ ăn (Diet Type)',
  })
  @ApiResponse({
    status: 200,
    description: 'Mục tiêu dinh dưỡng hàng ngày theo chế độ ăn.',
    schema: {
      example: {
        diet_type: 'STANDARD',
        daily_kcal_target: 2000,
        target_protein_g: 100,
        target_carbs_g: 250,
        target_fat_g: 67,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Chưa cập nhật Profile.' })
  getMacroTargets(@CurrentUser('sub') userId: string) {
    return this.nutritionService.getMacroTargets(userId);
  }
}
