import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo hoặc cập nhật nhật ký theo ngày' })
  @ApiBody({ type: CreateDailyLogDto })
  @ApiResponse({
    status: 201,
    description: 'Đã lưu nhật ký ngày.',
    schema: {
      example: {
        id: '9e0a1b13-dd4e-4484-b6b4-9828a82945be',
        user_id: 'f509dce0-4851-4b91-bbdc-4e9bc1f8d411',
        log_date: '2026-09-13',
        water_consumed_ml: 2200,
        total_kcal_in: 1850,
        total_kcal_out: 420,
        weight_log: 68.5,
        is_streak_day: false,
      },
    },
  })
  createDailyLog(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDailyLogDto,
  ) {
    return this.trackingService.createDailyLog(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy nhật ký theo ngày' })
  @ApiQuery({
    name: 'date',
    required: true,
    example: '2026-09-13',
    description: 'Ngày cần lấy nhật ký theo định dạng YYYY-MM-DD',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin nhật ký ngày của người dùng.',
    schema: {
      example: {
        user_id: 'f509dce0-4851-4b91-bbdc-4e9bc1f8d411',
        log_date: '2026-09-13',
        water_consumed_ml: 2200,
        total_kcal_in: 1850,
        total_kcal_out: 420,
        weight_log: 68.5,
        is_streak_day: false,
      },
    },
  })
  getDailyLog(@CurrentUser('sub') userId: string, @Query('date') date: string) {
    if (!date) {
      throw new BadRequestException('Thiếu tham số date');
    }

    return this.trackingService.getDailyLog(userId, date);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật nhật ký theo id' })
  @ApiBody({ type: UpdateDailyLogDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật nhật ký thành công.',
  })
  updateDailyLog(
    @CurrentUser('sub') userId: string,
    @Param('id') logId: string,
    @Body() dto: UpdateDailyLogDto,
  ) {
    return this.trackingService.updateDailyLog(userId, logId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa nhật ký theo id' })
  @ApiResponse({
    status: 200,
    description: 'Xóa nhật ký thành công.',
    schema: {
      example: {
        message: 'Đã xóa nhật ký ngày thành công',
      },
    },
  })
  deleteDailyLog(@CurrentUser('sub') userId: string, @Param('id') logId: string) {
    return this.trackingService.deleteDailyLog(userId, logId);
  }
}
