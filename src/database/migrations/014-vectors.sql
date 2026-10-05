-- Migration: vector/RAG (Phase 8) — embeddings món ăn + tóm tắt chat.
-- foods.embedding: vector 768 chiều (nomic-embed-text-v1_5 qua Groq),
-- backfill bằng scripts/backfill-food-embeddings.cjs (batch + backoff 429).
-- user_taste_profiles.chat_summary: AiChatService tóm tắt hàng tuần (cron).
-- Tự chạy khi backend boot (src/database/migrator.ts).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE foods ADD COLUMN IF NOT EXISTS embedding vector(768) NULL;
CREATE INDEX IF NOT EXISTS idx_foods_embedding
  ON foods USING hnsw (embedding vector_cosine_ops);

ALTER TABLE user_taste_profiles
  ADD COLUMN IF NOT EXISTS chat_summary TEXT NULL;
ALTER TABLE user_taste_profiles
  ADD COLUMN IF NOT EXISTS chat_summary_at TIMESTAMPTZ NULL;
