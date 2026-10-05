import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { LocalizationService } from '../i18n/localization.service';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { SemanticSearchDto } from './dto/semantic-search.dto';
import { escapeLike, toSearchNorm } from './search-norm';
import { Food } from './entities/food.entity';

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    @InjectRepository(Food)
    private readonly foodRepo: Repository<Food>,
    private readonly i18n: LocalizationService,
    private readonly embeddings: EmbeddingsService,
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

  // Tìm ngữ nghĩa bằng vector (Phase 8): embed câu hỏi → cosine pgvector.
  // Lọc cứng (kcal) chạy trước trong SQL; Groq lỗi → rớt về tìm từ khóa.
  async semanticSearch(dto: SemanticSearchDto) {
    const limit = Math.min(Math.max(dto.limit ?? 10, 1), 30);
    const q = dto.q.trim();
    try {
      const [vec] = await this.embeddings.embed([q]);
      if (!vec) throw new Error('empty embedding');
      const params: (string | number)[] = [`[${vec.join(',')}]`];
      let kcalFilter = '';
      if (dto.max_kcal !== undefined) {
        params.push(dto.max_kcal);
        kcalFilter = `AND kcal_100g <= $${params.length}`;
      }
      params.push(limit);
      const raw: unknown = await this.foodRepo.query(
        `SELECT id, code, food_name_vi, display_name_vi, food_name_en, kcal_100g, protein_100g,
          carbs_100g, fat_100g, source,
          1 - (embedding <=> $1) AS similarity
         FROM foods
         WHERE embedding IS NOT NULL ${kcalFilter}
         ORDER BY embedding <=> $1 LIMIT $${params.length}`,
        params,
      );
      const rows = raw as (Food & { similarity: number })[];
      return {
        engine: 'vector' as const,
        matches: rows.map((r) => ({
          ...r,
          similarity: Math.round(Number(r.similarity) * 1000) / 1000,
        })),
      };
    } catch (error) {
      this.logger.warn(`Semantic search rớt về từ khóa: ${String(error)}`);
      return {
        engine: 'keyword' as const,
        matches: await this.search({ q, limit }),
      };
    }
  }
}
