import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Nutrition')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách món yêu thích của tôi' })
  list(@CurrentUser('sub') userId: string) {
    return this.favoritesService.list(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Lưu món yêu thích (từ catalog hoặc tự nhập)' })
  @ApiBody({ type: CreateFavoriteDto })
  @ApiResponse({ status: 201, description: 'Lưu món yêu thích thành công.' })
  @ApiResponse({ status: 409, description: 'Món đã có trong yêu thích.' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.create(userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa món yêu thích' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy.' })
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.favoritesService.remove(userId, id);
  }
}
