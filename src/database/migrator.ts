import { Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const logger = new Logger('Migrations');

// Cột bắt buộc cho Auth (login/refresh/Google login đều SELECT full User).
// Vá riêng trước mọi thứ để 1 câu repair khác lỗi cũng không chặn login.
const CRITICAL_STATEMENTS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'USER'`,
];

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
 * Tách file SQL thành từng statement, tôn trọng khối dollar-quoted
 * ($$...$$), string đơn ('...') và comment (-- / slash-star) để thân
 * function plpgsql chứa ';' không bị chém nhỏ.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let i = 0;
  let dollarTag: string | null = null;
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (next2 === '*/') {
        buf += sql[i + 1];
        i += 2;
        inBlockComment = false;
      } else {
        i += 1;
      }
      continue;
    }
    if (inSingleQuote) {
      buf += ch;
      if (ch === "'" && sql[i + 1] === "'") {
        buf += sql[i + 1]; // escape '' trong string
        i += 2;
      } else if (ch === "'") {
        inSingleQuote = false;
        i += 1;
      } else {
        i += 1;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        buf += ch;
        i += 1;
      }
      continue;
    }

    if (next2 === '--') {
      inLineComment = true;
      buf += next2;
      i += 2;
      continue;
    }
    if (next2 === '/*') {
      inBlockComment = true;
      buf += next2;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingleQuote = true;
      buf += ch;
      i += 1;
      continue;
    }
    const dollarMatch = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollarMatch) {
      dollarTag = dollarMatch[0];
      buf += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === ';') {
      buf += ch;
      i += 1;
      const stmt = buf.trim();
      if (stmt.length > 1 && stripComments(stmt).length > 0) {
        statements.push(stmt);
      }
      buf = '';
      continue;
    }
    buf += ch;
    i += 1;
  }

  const tail = buf.trim();
  if (tail.length > 0 && stripComments(tail).length > 0) {
    statements.push(tail);
  }
  return statements;
}

function stripComments(stmt: string): string {
  return stmt
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
}

/**
 * Tự chạy các file *.sql trong database/migrations theo thứ tự tên,
 * bỏ qua file đã applied (bảng schema_migrations).
 * Sau đó luôn chạy repair.sql (idempotent) để tự vá schema nếu DB bị
 * sửa từ bên ngoài (VD: cột role bị thiếu dù migration đã applied).
 * Gọi 1 lần lúc boot để deploy nào cũng đủ schema.
 *
 * Nguyên tắc chống sập login:
 * - Cột users.role được vá RIÊNG trước mọi thứ (CRITICAL_STATEMENTS),
 *   kể cả khi thư mục migrations / repair.sql thiếu trong image.
 * - repair.sql chạy TỪNG câu, câu nào lỗi chỉ warn rồi tiếp tục,
 *   để 1 câu optional (VD: extension vector) không chặn các câu sau.
 */
export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL missing — skipping auto-migrations.');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: sslConfig(databaseUrl),
  });
  await client.connect();
  try {
    // 1. Vá cột sống còn của Auth trước — login/refresh/Google login
    // đều SELECT full User nên thiếu cột là sập 500.
    for (const stmt of CRITICAL_STATEMENTS) {
      try {
        await client.query(stmt);
      } catch (error) {
        logger.warn(
          `Critical schema fix failed (continuing): ${String(error)}`,
        );
      }
    }

    // 2. Migrations theo file. Không đọc được thư mục thì chỉ warn rồi vẫn chạy repair.
    const dir = join(__dirname, 'migrations');
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch (error) {
      logger.warn(
        `Cannot read migrations dir ${dir} — running repair only: ${String(error)}`,
      );
      files = [];
    }

    if (files.length > 0) {
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
    }

    // 3. repair.sql từng câu — 1 câu lỗi không chặn các câu sau.
    try {
      const repairSql = readFileSync(join(__dirname, 'repair.sql'), 'utf8');
      let ok = 0;
      let failed = 0;
      for (const stmt of splitStatements(repairSql)) {
        try {
          await client.query(stmt);
          ok += 1;
        } catch (error) {
          failed += 1;
          logger.warn(
            `Repair statement failed (continuing): ${stmt.slice(0, 120)}... — ${String(error)}`,
          );
        }
      }
      logger.log(`Critical schema verified (${ok} ok, ${failed} failed).`);
    } catch (error) {
      logger.warn(`Cannot read repair.sql — skipping: ${String(error)}`);
    }
  } finally {
    await client.end();
  }
}
