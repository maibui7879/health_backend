import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { FoodsService } from './foods.service';

@ApiTags('Nutrition')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-access'))
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Tra cứu thực phẩm (kcal/macro trên 100g)' })
  search(@Query() dto: SearchFoodsDto) {
    return this.foodsService.search(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết 1 món trong catalog' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy món ăn.' })
  getById(@Param('id') id: string) {
    return this.foodsService.getById(id);
  }
}
