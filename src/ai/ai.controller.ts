import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FileFilterCallback } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LocalizationService, t } from '../i18n/localization.service';
import { UsersService } from '../users/users.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { AnalyzeFoodRequestDto } from './dto/analyze-food-request.dto';
import { AnalyzeFoodResponseDto } from './dto/analyze-food-response.dto';
import { SuggestMenuRequestDto } from './dto/suggest-menu-request.dto';
import { SuggestMenuResponseDto } from './dto/suggest-menu-response.dto';
import { SuggestPlanRequestDto } from './dto/suggest-plan-request.dto';
import { SuggestPlanResponseDto } from './dto/suggest-plan-response.dto';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
    private readonly nutritionService: NutritionService,
    private readonly i18n: LocalizationService,
  ) {}

  @Post('analyze-food')
  @UseGuards(AuthGuard('jwt-access'))
  @ApiOperation({ summary: 'Phân tích món ăn từ hình ảnh (AI Groq)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AnalyzeFoodRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
    type: AnalyzeFoodResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (
        _request: Express.Request,
        file: Express.Multer.File,
        callback: FileFilterCallback,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
          return callback(new Error(t('ai.imageTypeOnly')));
        }
        callback(null, true);
      },
    }),
  )
  async analyzeFood(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: AnalyzeFoodRequestDto,
  ) {
    if (!file) {
      throw new BadRequestException(this.i18n.t('ai.imageRequired'));
    }

    const user = await this.usersService.getMe(userId);
    const userAllergies =
      user.allergies?.map((allergy) => allergy.allergen_name) ?? [];
    const dietType = user.profile?.diet_type ?? 'STANDARD';

    const aiResult = await this.aiService.analyzeFoodImage(
      file.buffer,
      file.mimetype,
      userAllergies,
      dietType,
      body.weight_g,
      body.additional_info,
    );

    return {
      success: true,
      message: this.i18n.t('ai.analyzeOk'),
      data: aiResult,
    };
  }

  @Post('suggest-menu')
  @UseGuards(AuthGuard('jwt-access'))
  @ApiOperation({ summary: 'Gợi ý thực đơn bằng AI theo hồ sơ người dùng' })
  @ApiBody({ type: SuggestMenuRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Thành công',
    type: SuggestMenuResponseDto,
  })
  async suggestMenu(
    @CurrentUser('sub') userId: string,
    @Body() dto: SuggestMenuRequestDto,
  ) {
    const user = await this.usersService.getMe(userId);
    const userAllergies =
      user.allergies?.map((allergy) => allergy.allergen_name) ?? [];
    const profile = user.profile ?? ({} as Record<string, any>);
    const dietType = profile.diet_type ?? 'STANDARD';
    const dailyTarget = Number(profile.daily_kcal_target ?? 1800) || 1800;

    const today = dto.date ?? new Date().toISOString().split('T')[0];
    const dashboard = await this.nutritionService
      .getDailyDashboard(userId, today)
      .catch(() => null);
    const consumedKcal = Number(dashboard?.total_kcal ?? 0) || 0;

    let macroProtein: number | undefined;
    let macroCarbs: number | undefined;
    let macroFat: number | undefined;
    try {
      const targets = (await this.nutritionService.getMacroTargets(
        userId,
      )) as Record<string, any>;
      macroProtein = Number(targets.target_protein_g) || undefined;
      macroCarbs = Number(targets.target_carbs_g) || undefined;
      macroFat = Number(targets.target_fat_g) || undefined;
    } catch {
      // hồ sơ chưa đủ để tính macro — AI gợi ý theo kcal
    }

    let age: number | undefined;
    if (profile.date_of_birth) {
      const dob = new Date(profile.date_of_birth);
      if (!Number.isNaN(dob.getTime())) {
        age = new Date().getFullYear() - dob.getFullYear();
      }
    }

    const remainingKcal = Math.max(0, dailyTarget - consumedKcal);
    const kcalTarget =
      dto.kcal_target ??
      (dto.meal_type ? Math.round(dailyTarget / 3) : dailyTarget);

    const menu = await this.aiService.suggestMenu({
      userAllergies,
      dietType,
      kcalTarget,
      mealType: dto.meal_type,
      goalType: profile.goal_type ?? 'MAINTAIN',
      age,
      gender: profile.gender,
      weightKg: Number(profile.current_weight_kg) || undefined,
      consumedKcal,
      remainingKcal,
      macroProteinG: macroProtein,
      macroCarbsG: macroCarbs,
      macroFatG: macroFat,
      note: dto.note,
    });

    return {
      success: true,
      message: this.i18n.t('ai.menuOk'),
      data: menu,
    };
  }

  @Post('suggest-plan')
  @UseGuards(AuthGuard('jwt-access'))
  @ApiOperation({ summary: 'Gợi ý kế hoạch ăn uống + luyện tập theo ngày' })
  @ApiBody({ type: SuggestPlanRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Thành công',
    type: SuggestPlanResponseDto,
  })
  async suggestPlan(
    @CurrentUser('sub') userId: string,
    @Body() dto: SuggestPlanRequestDto,
  ) {
    const user = await this.usersService.getMe(userId);
    const profile = (user.profile ?? {}) as Record<string, any>;
    const userAllergies =
      user.allergies?.map((allergy) => allergy.allergen_name) ?? [];

    let macroProtein: number | undefined;
    let macroCarbs: number | undefined;
    let macroFat: number | undefined;
    try {
      const targets = (await this.nutritionService.getMacroTargets(
        userId,
      )) as Record<string, any>;
      macroProtein = Number(targets.target_protein_g) || undefined;
      macroCarbs = Number(targets.target_carbs_g) || undefined;
      macroFat = Number(targets.target_fat_g) || undefined;
    } catch {
      // hồ sơ chưa đủ để tính macro
    }

    let age: number | undefined;
    if (profile.date_of_birth) {
      const dob = new Date(profile.date_of_birth);
      if (!Number.isNaN(dob.getTime())) {
        age = new Date().getFullYear() - dob.getFullYear();
      }
    }

    const plan = await this.aiService.suggestPlan({
      userAllergies,
      dietType: profile.diet_type ?? 'STANDARD',
      goalType: profile.goal_type ?? 'MAINTAIN',
      age,
      gender: profile.gender,
      heightCm: Number(profile.height_cm) || undefined,
      weightKg: Number(profile.current_weight_kg) || undefined,
      activityLevel: profile.activity_level,
      dailyKcalTarget: Number(profile.daily_kcal_target ?? 1800) || 1800,
      macroProteinG: macroProtein,
      macroCarbsG: macroCarbs,
      macroFatG: macroFat,
      durationDays: dto.duration_days ?? 7,
    });

    return {
      success: true,
      message: this.i18n.t('ai.planOk'),
      data: plan,
    };
  }
}
