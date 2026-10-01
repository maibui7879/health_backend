import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../i18n/localization.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteFood)
    private readonly favoriteRepo: Repository<FavoriteFood>,
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
  ) {}

  async list(userId: string) {
    return this.favoriteRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateFavoriteDto) {
    let snapshot = {
      food_name_vi: dto.food_name_vi?.trim() ?? '',
      food_name_en: dto.food_name_en?.trim() || (null as string | null),
      kcal_100g: dto.kcal_100g ?? 0,
      protein_100g: dto.protein_100g ?? 0,
      carbs_100g: dto.carbs_100g ?? 0,
      fat_100g: dto.fat_100g ?? 0,
    };
    let foodId: string | null = null;

    if (dto.food_id) {
      const food = await this.foodRepo.findOne({
        where: { id: dto.food_id },
      });
      if (!food) {
        throw new NotFoundException(this.i18n.t('foods.notFound'));
      }
      const dup = await this.favoriteRepo.findOne({
        where: { user_id: userId, food_id: food.id },
      });
      if (dup) {
        throw new ConflictException(this.i18n.t('favorites.exists'));
      }
      foodId = food.id;
      snapshot = {
        food_name_vi: food.food_name_vi,
        food_name_en: food.food_name_en,
        kcal_100g: food.kcal_100g,
        protein_100g: food.protein_100g,
        carbs_100g: food.carbs_100g,
        fat_100g: food.fat_100g,
      };
    } else {
      if (!snapshot.food_name_vi) {
        throw new BadRequestException(this.i18n.t('favorites.nameRequired'));
      }
    }

    const fav = this.favoriteRepo.create({
      user_id: userId,
      food_id: foodId,
      ...snapshot,
      note: dto.note?.trim() || null,
    });
    const saved = await this.favoriteRepo.save(fav);
    return { message: this.i18n.t('favorites.created'), favorite: saved };
  }

  async remove(userId: string, id: string) {
    const fav = await this.favoriteRepo.findOne({ where: { id } });
    if (!fav) {
      throw new NotFoundException(this.i18n.t('favorites.notFound'));
    }
    if (fav.user_id !== userId) {
      throw new ForbiddenException(this.i18n.t('favorites.forbidden'));
    }
    await this.favoriteRepo.remove(fav);
    return { message: this.i18n.t('favorites.deleted') };
  }
}
