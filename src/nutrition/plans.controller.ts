import {
  Body,
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
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  AdherenceQueryDto,
  CloneTemplateDto,
  CreatePlanDto,
  PlanQueryDto,
  PublishTemplateDto,
  TemplateQueryDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { NutritionPlansService } from './plans.service';

@ApiTags('Nutrition')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('nutrition')
export class NutritionPlansController {
  constructor(private readonly plansService: NutritionPlansService) {}

  @Post('plans')
  @ApiOperation({
    summary: 'Lưu plan đang theo (từ output suggest-plan)',
  })
  @ApiBody({ type: CreatePlanDto })
  @ApiResponse({ status: 201, description: 'Lưu plan thành công.' })
  @ApiResponse({ status: 400, description: 'Khoảng ngày không hợp lệ.' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreatePlanDto) {
    return this.plansService.create(userId, dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Danh sách plan (mặc định chỉ ACTIVE)' })
  list(@CurrentUser('sub') userId: string, @Query() query: PlanQueryDto) {
    return this.plansService.list(userId, query);
  }

  @Get('plans/templates')
  @ApiOperation({ summary: 'Gallery mẫu plan cộng đồng' })
  templates(@Query() query: TemplateQueryDto) {
    return this.plansService.listTemplates(query);
  }

  @Post('plans/templates/:id/clone')
  @ApiOperation({ summary: 'Bê mẫu về thành plan của mình' })
  @ApiResponse({ status: 201, description: 'Bê mẫu thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy mẫu.' })
  clone(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CloneTemplateDto,
  ) {
    return this.plansService.clone(userId, id, dto);
  }

  @Post('plans/:id/publish')
  @ApiOperation({ summary: 'Đăng plan COMPLETED thành mẫu chia sẻ' })
  @ApiResponse({ status: 201, description: 'Đăng mẫu thành công.' })
  @ApiResponse({
    status: 400,
    description: 'Chưa hoàn thành / điểm tuân thủ thấp.',
  })
  publish(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PublishTemplateDto,
  ) {
    return this.plansService.publish(userId, id, dto);
  }

  @Get('plans/active/adherence')
  @ApiOperation({ summary: 'So plan ACTIVE vs thực tế trong 1 ngày' })
  activeAdherence(
    @CurrentUser('sub') userId: string,
    @Query() query: AdherenceQueryDto,
  ) {
    return this.plansService.adherence(userId, query.date);
  }

  @Get('plans/:id/adherence')
  @ApiOperation({ summary: 'So plan vs thực tế trong 1 ngày + chấm điểm' })
  @ApiResponse({ status: 404, description: 'Không có plan / ngày ngoài plan.' })
  adherence(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query() query: AdherenceQueryDto,
  ) {
    return this.plansService.adherence(userId, query.date, id);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Chi tiết 1 plan' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kế hoạch.' })
  getOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.plansService.getOne(userId, id);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Hoàn thành / bỏ / kích hoạt lại plan' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(userId, id, dto);
  }
}
