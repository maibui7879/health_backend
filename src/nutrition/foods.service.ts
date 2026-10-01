import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { Food } from './entities/food.entity';

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
  ) {}

  async search(dto: SearchFoodsDto) {
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 50);
    const qb = this.foodRepo
      .createQueryBuilder('food')
      .orderBy('food.food_name_vi', 'ASC')
      .take(limit);

    const q = dto.q?.trim();
    if (q) {
      qb.where('(food.food_name_vi ILIKE :q OR food.food_name_en ILIKE :q)', {
        q: `%${q}%`,
      });
    }
    return qb.getMany();
  }

  async getById(id: string) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(this.i18n.t('foods.notFound'));
    }
    return food;
  }
}
