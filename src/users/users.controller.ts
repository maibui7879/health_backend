import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import type { FileFilterCallback } from 'multer';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { t } from '../i18n/localization.service';
import { UpdateAllergiesDto } from './dto/update-allergies.dto';
import { UpdateDeviceTokenDto } from './dto/update-device-token.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy hồ sơ cá nhân hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Trả về thông tin user, profile, setting và allergies.',
  })
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Cập nhật sinh trắc học và mục tiêu' })
  @ApiResponse({ status: 200, description: 'Cập nhật profile thành công.' })
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Put('allergies')
  @ApiOperation({ summary: 'Cập nhật danh sách chất gây dị ứng' })
  @ApiResponse({ status: 200, description: 'Cập nhật dị ứng thành công.' })
  updateAllergies(
    @CurrentUser('sub') userId: string,
    @Body() updateAllergiesDto: UpdateAllergiesDto,
  ) {
    return this.usersService.updateAllergies(
      userId,
      updateAllergiesDto.allergies,
    );
  }

  @Put('settings')
  @ApiOperation({ summary: 'Cập nhật cài đặt thông báo' })
  @ApiResponse({ status: 200, description: 'Cập nhật cài đặt thành công.' })
  updateSettings(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.usersService.updateSettings(userId, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Lấy cài đặt hiện tại (kèm locale vi|en)' })
  @ApiResponse({ status: 200, description: 'Trả về cài đặt của user.' })
  getSettings(@CurrentUser('sub') userId: string) {
    return this.usersService.getSettings(userId);
  }

  @Put('settings/locale')
  @ApiOperation({ summary: 'Đổi ngôn ngữ hiển thị (vi|en)' })
  @ApiResponse({ status: 200, description: 'Đổi ngôn ngữ thành công.' })
  @ApiResponse({ status: 400, description: 'Locale không hợp lệ.' })
  updateLocale(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateLocaleDto,
  ) {
    return this.usersService.updateLocale(userId, dto.locale);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload ảnh đại diện (jpg/png/webp, tối đa 2MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Upload avatar thành công.' })
  @ApiResponse({ status: 400, description: 'File không hợp lệ.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(
            process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
            'avatars',
          );
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const user = req.user as unknown;
          let sub = 'unknown';
          if (typeof user === 'object' && user !== null && 'sub' in user) {
            const raw: unknown = user.sub;
            if (typeof raw === 'string' && raw) sub = raw;
          }
          cb(null, `${sub}-${Date.now()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (
        _request: Express.Request,
        file: Express.Multer.File,
        callback: FileFilterCallback,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/i)) {
          return callback(new Error(t('users.avatarTypeOnly')));
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(t('users.avatarRequired'));
    }
    return this.usersService.updateAvatar(userId, file.filename);
  }

  @Put('device-token')
  @ApiOperation({
    summary: 'Cập nhật FCM Device Token để nhận Push Notification',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật Device Token thành công.',
  })
  updateDeviceToken(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateDeviceTokenDto,
  ) {
    return this.usersService.updateDeviceToken(userId, dto.device_token);
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Xóa vĩnh viễn tài khoản (Dành cho App Store / Google Play)',
  })
  @ApiResponse({ status: 200, description: 'Xóa tài khoản thành công.' })
  deleteAccount(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
