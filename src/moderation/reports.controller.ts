import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubmitReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiOperation({
    summary: 'Tố cáo bài/comment/user/buổi tập/template/món ăn',
  })
  @ApiResponse({ status: 201, description: 'Đã ghi nhận tố cáo.' })
  @ApiResponse({ status: 409, description: 'Đã tố cáo target này rồi.' })
  submit(@CurrentUser('sub') userId: string, @Body() dto: SubmitReportDto) {
    return this.reports.fileReport(userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Tố cáo tôi đã gửi + trạng thái xử lý' })
  mine(@CurrentUser('sub') userId: string) {
    return this.reports.myReports(userId);
  }
}
