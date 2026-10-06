import {
  Controller,
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
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo (mới nhất trước)' })
  @ApiQuery({ name: 'unread', required: false, example: 'true' })
  list(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(
      userId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      unread === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Số chưa đọc (hiện badge)' })
  unreadCount(@CurrentUser('sub') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc' })
  markRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  markAllRead(@CurrentUser('sub') userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
