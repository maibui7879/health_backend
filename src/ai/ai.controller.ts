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
import { UsersService } from '../users/users.service';
import { AnalyzeFoodRequestDto } from './dto/analyze-food-request.dto';
import { AnalyzeFoodResponseDto } from './dto/analyze-food-response.dto';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usersService: UsersService,
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
          return callback(
            new BadRequestException('Chỉ chấp nhận ảnh (jpg, png, webp)'),
            false,
          );
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
      throw new BadRequestException('Vui lòng đính kèm một hình ảnh món ăn.');
    }

    const user = await this.usersService.getMe(userId);
    const userAllergies =
      user.allergies?.map((allergy) => allergy.allergen_code) ?? [];

    const aiResult = await this.aiService.analyzeFoodImage(
      file.buffer,
      file.mimetype,
      userAllergies,
      body.weight_g,
      body.additional_info,
    );

    return {
      success: true,
      message: 'Nhận diện thành công',
      data: aiResult,
    };
  }
}
