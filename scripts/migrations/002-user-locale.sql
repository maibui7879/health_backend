-- Migration: user locale (Phase 0 i18n vi+en)
-- Chạy tay vì TypeORM synchronize=false.
-- Lệnh: psql "$DATABASE_URL" -f scripts/migrations/002-user-locale.sql

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS locale VARCHAR(5) DEFAULT 'vi';

UPDATE user_settings SET locale = 'vi' WHERE locale IS NULL;
