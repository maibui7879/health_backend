import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { escapeLike, toSearchNorm } from './search-norm';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { Food } from './entities/food.entity';

@Injectable()
export class FoodsService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
  ) {}

  // Tìm theo search_norm (tên vi+en bỏ dấu, trigger duy trì — migration 011):
  // khớp chuỗi con trước, similarity (pg_trgm) vét sau cho gõ sai nhẹ.
  async search(dto: SearchFoodsDto) {
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 50);
    const q = dto.q?.trim();
    const norm = q ? toSearchNorm(q) : '';
    if (!norm) {
      return this.foodRepo.find({
        order: { food_name_vi: 'ASC' },
        take: limit,
      });
    }

    const like = await this.foodRepo
      .createQueryBuilder('food')
      .where('food.search_norm ILIKE :like', {
        like: `%${escapeLike(norm)}%`,
      })
      .orderBy('food.food_name_vi', 'ASC')
      .take(limit)
      .getMany();
    if (like.length >= limit) return like;

    const exclude = like.map((f) => f.id);
    const fuzzy = await this.foodRepo
      .createQueryBuilder('food')
      .where('food.search_norm % :norm', { norm })
      .andWhere(exclude.length > 0 ? 'food.id NOT IN (:...exclude)' : '1=1', {
        exclude,
      })
      .orderBy('similarity(food.search_norm, :norm)', 'DESC')
      .take(limit - like.length)
      .getMany();
    return [...like, ...fuzzy];
  }

  async getById(id: string) {
    const food = await this.foodRepo.findOne({ where: { id } });
    if (!food) {
      throw new NotFoundException(this.i18n.t('foods.notFound'));
    }
    return food;
  }
}
