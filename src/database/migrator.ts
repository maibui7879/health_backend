import { Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const logger = new Logger('Migrations');

function sslConfig(url: string): { rejectUnauthorized: boolean } | undefined {
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return undefined;
    }
  } catch {
    // URL lạ — mặc định bật SSL như trước.
  }
  return { rejectUnauthorized: false };
}

/**
 * Tự chạy các file *.sql trong database/migrations theo thứ tự tên,
 * bỏ qua file đã applied (bảng schema_migrations).
 * Sau đó luôn chạy repair.sql (idempotent) để tự vá schema nếu DB bị
 * sửa từ bên ngoài (VD: cột locale bị xóa dù migration đã applied).
 * Gọi 1 lần lúc boot để deploy nào cũng đủ schema.
 */
export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL missing — skipping auto-migrations.');
    return;
  }

  const dir = join(__dirname, 'migrations');
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (error) {
    logger.warn(
      `Cannot read migrations dir ${dir} — skipping auto-migrations: ${String(error)}`,
    );
    return;
  }
  if (files.length === 0) return;

  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslConfig(databaseUrl),
  });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    );
    const appliedRows = (
      await client.query('SELECT name FROM schema_migrations')
    ).rows as { name: string }[];
    const applied = new Set(appliedRows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) continue;
      logger.log(`Applying migration ${file}...`);
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [
        file,
      ]);
      logger.log(`Applied migration ${file}.`);
    }

    logger.log('Verifying critical schema (repair.sql)...');
    await client.query(readFileSync(join(__dirname, 'repair.sql'), 'utf8'));
    logger.log('Critical schema verified.');
  } finally {
    await client.end();
  }
}
