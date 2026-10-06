import {
  Body,
  Controller,
  Get,
  Param,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { ReviewReportDto } from './dto/report.dto';
import { ReportTarget } from './entities/report-case.entity';
import { ReportsService } from './reports.service';

@ApiTags('AdminReports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Hàng chờ duyệt (lọc theo loại)' })
  @ApiQuery({ name: 'target_type', required: false, enum: ReportTarget })
  pending(@Query('target_type') targetType?: ReportTarget) {
    return this.reports.pendingList(targetType);
  }

  @Post(':id/review')
  @ApiOperation({
    summary: '[Admin] Chốt: DISMISS / HIDE_POST / DELETE_COMMENT / BAN_USER ...',
  })
  review(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reports.review(adminId, id, dto);
  }
}
