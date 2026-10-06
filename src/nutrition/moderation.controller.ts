import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import {
  ModerationService,
} from './moderation.service';
import { SubmitFoodDto } from './dto/submit-food.dto';

@ApiTags('FoodModeration')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('foods/submissions')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post()
  @ApiOperation({ summary: 'Gửi món mới chờ admin duyệt' })
  @ApiResponse({ status: 201, description: 'Đã gửi, chờ duyệt.' })
  submit(@CurrentUser('sub') userId: string, @Body() dto: SubmitFoodDto) {
    return this.moderation.submit(userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Món tôi đã gửi + trạng thái duyệt' })
  mine(@CurrentUser('sub') userId: string) {
    return this.moderation.mySubmissions(userId);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Hàng chờ duyệt' })
  pending() {
    return this.moderation.pendingList();
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Duyệt — đưa vào catalog' })
  @ApiResponse({ status: 409, description: 'Tên đã có trong catalog.' })
  approve(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
  ) {
    return this.moderation.approve(adminId, id);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: '[Admin] Từ chối' })
  reject(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
  ) {
    return this.moderation.reject(adminId, id);
  }
}
