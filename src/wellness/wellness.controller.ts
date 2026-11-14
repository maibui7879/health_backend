import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AcceptConsentDto, AddWaterDto, HistoryRangeDto } from './wellness.dto';
import {
  LEGAL_VERSION,
  MEDICAL_DISCLAIMER,
  WellnessService,
} from './wellness.service';

@Controller('wellness')
@ApiTags('Wellness')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
export class WellnessController {
  constructor(private readonly service: WellnessService) {}

  @Get('menu-templates')
  templates(@CurrentUser('sub') id: string) {
    return this.service.menuTemplates(id);
  }

  @Get('onboarding')
  onboarding(@CurrentUser('sub') id: string) {
    return this.service.onboarding(id);
  }

  @Get('home')
  home(@CurrentUser('sub') id: string, @Query('date') date?: string) {
    return this.service.home(id, date);
  }

  @Get('measurements')
  history(@CurrentUser('sub') id: string, @Query() query: HistoryRangeDto) {
    return this.service.history(id, query);
  }

  @Get('stats')
  stats(@CurrentUser('sub') id: string, @Query() query: HistoryRangeDto) {
    return this.service.statistics(id, query);
  }

  @Get('water/streak')
  streak(@CurrentUser('sub') id: string) {
    return this.service.waterStreak(id);
  }

  @Get('water')
  water(@CurrentUser('sub') id: string, @Query('date') date?: string) {
    return this.service.waterEntries(id, date);
  }

  @Post('water')
  addWater(@CurrentUser('sub') id: string, @Body() body: AddWaterDto) {
    return this.service.addWater(id, body);
  }

  @Delete('water/:id')
  deleteWater(
    @CurrentUser('sub') user: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteWater(user, id);
  }

  @Get('consent')
  consent(@CurrentUser('sub') id: string) {
    return this.service.consent(id);
  }

  @Post('consent')
  accept(@CurrentUser('sub') id: string, @Body() body: AcceptConsentDto) {
    return this.service.acceptConsent(id, body.version);
  }
}

@Controller('legal')
@ApiTags('Legal')
export class LegalController {
  @Get()
  documents() {
    return {
      version: LEGAL_VERSION,
      medical_disclaimer: MEDICAL_DISCLAIMER,
      terms:
        'Sử dụng ứng dụng tự nguyện. Số liệu do người dùng nhập và AI ước tính có thể sai; hãy kiểm tra trước khi áp dụng. Khi có triệu chứng hoặc bệnh lý, cần tư vấn chuyên môn.',
      privacy:
        'Ứng dụng lưu thông tin tài khoản, hồ sơ sức khỏe, nhật ký ăn/uống/tập và lịch sử đồng ý để cung cấp các tính năng đã chọn. Ảnh và nội dung gửi cho AI được xử lý bởi nhà cung cấp AI cấu hình trên hệ thống. Không nhập dữ liệu không cần thiết. Có thể xóa tài khoản qua DELETE /users/me.',
    };
  }
}
