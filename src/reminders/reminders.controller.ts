import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReminderDto, UpdateReminderDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách lịch nhắc của tôi' })
  list(@CurrentUser('sub') userId: string) {
    return this.remindersService.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo lịch nhắc (giờ UTC, HH:mm)' })
  @ApiResponse({ status: 201, description: 'Tạo lịch nhắc thành công.' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa giờ/ngày/bật-tắt lịch nhắc' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa lịch nhắc' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.remindersService.remove(userId, id);
  }
}
