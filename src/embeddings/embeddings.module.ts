import { Global, Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

// @Global để Nutrition/AI dùng chung mà không tạo vòng import module
// (AiModule ↔ NutritionModule đã phụ thuộc nhau).
@Global()
@Module({
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
