import { Client } from 'pg';
import { runMigrations, splitStatements } from './migrator';

jest.mock('pg');

const MockClient = Client as unknown as jest.Mock;
const OLD_ENV = process.env;

describe('runMigrations', () => {
  let query: jest.Mock;
  let appliedNames: string[];

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    };
    appliedNames = [];
    query = jest.fn((sql: string) => {
      if (sql.startsWith('SELECT name')) {
        return Promise.resolve({
          rows: appliedNames.map((name) => ({ name })),
        });
      }
      return Promise.resolve({ rows: [] });
    });
    MockClient.mockImplementation(() => ({
      query,
      connect: jest.fn(() => Promise.resolve(undefined)),
      end: jest.fn(() => Promise.resolve(undefined)),
    }));
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  it('skips everything when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    await runMigrations();
    expect(MockClient).not.toHaveBeenCalled();
  });

  it('applies pending migrations in filename order, then repairs', async () => {
    await runMigrations();
    const executed: string[] = query.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    // Cột users.role luôn được vá trước mọi migration.
    expect(executed[0]).toContain('ADD COLUMN IF NOT EXISTS role');
    const aiIndex = executed.findIndex((s) => s.includes('ai_conversations'));
    const otpIndex = executed.findIndex((s) =>
      s.includes('password_reset_otps'),
    );
    expect(aiIndex).toBeGreaterThanOrEqual(1);
    expect(otpIndex).toBeGreaterThan(aiIndex);
    const inserts = executed.filter((s) =>
      s.startsWith('INSERT INTO schema_migrations'),
    );
    expect(inserts).toHaveLength(25);
    // Repair chạy từng câu sau cùng — vẫn phải có câu vá bảng OTP.
    expect(executed.some((s) => s.includes('password_reset_otps'))).toBe(true);
  });

  it('skips applied migrations but still repairs schema', async () => {
    appliedNames = [
      '001-ai-chat.sql',
      '002-user-locale.sql',
      '003-password-reset-otps.sql',
      '004-registration-otps.sql',
      '005-reminders.sql',
      '006-nutrition-plans.sql',
      '007-foods-catalog.sql',
      '008-plan-templates.sql',
      '009-community.sql',
      '010-foods-vn-expand.sql',
      '011-foods-fuzzy-search.sql',
      '012-taste-profiles.sql',
      '013-community-ranking.sql',
      '014-vectors.sql',
      '015-foods-stable-codes.sql',
      '016-workout-media.sql',
      '017-exercise-templates.sql',
      '018-workout-goals.sql',
      '019-template-durations.sql',
      '021-food-images.sql',
      '022-food-images-2.sql',
      '023-food-images-3.sql',
      '024-food-moderation.sql',
      '025-reports.sql',
      '026-notifications.sql',
    ];
    await runMigrations();
    const executed: string[] = query.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(
      executed.some((s) => s.startsWith('INSERT INTO schema_migrations')),
    ).toBe(false);
    // Repair chạy mỗi lần boot để tự vá schema bị sửa từ bên ngoài.
    expect(executed.some((s) => s.includes('password_reset_otps'))).toBe(true);
    // Cột users.role vẫn được vá kể cả khi mọi migration đã applied.
    expect(
      executed.some((s) => s.includes('ADD COLUMN IF NOT EXISTS role')),
    ).toBe(true);
  });

  it('uses SSL for non-local databases', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@remote.host:5432/db';
    await runMigrations();
    expect(MockClient).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: { rejectUnauthorized: false } }),
    );
  });

  it('continues repair when one statement fails', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT name')) {
        return Promise.resolve({
          rows: appliedNames.map((name) => ({ name })),
        });
      }
      if (sql.includes('CREATE EXTENSION')) {
        return Promise.reject(new Error('extension not available'));
      }
      return Promise.resolve({ rows: [] });
    });
    appliedNames = [
      '001-ai-chat.sql',
      '002-user-locale.sql',
      '003-password-reset-otps.sql',
      '004-registration-otps.sql',
      '005-reminders.sql',
      '006-nutrition-plans.sql',
      '007-foods-catalog.sql',
      '008-plan-templates.sql',
      '009-community.sql',
      '010-foods-vn-expand.sql',
      '011-foods-fuzzy-search.sql',
      '012-taste-profiles.sql',
      '013-community-ranking.sql',
      '014-vectors.sql',
      '015-foods-stable-codes.sql',
      '016-workout-media.sql',
      '017-exercise-templates.sql',
      '018-workout-goals.sql',
      '019-template-durations.sql',
      '021-food-images.sql',
      '022-food-images-2.sql',
      '023-food-images-3.sql',
      '024-food-moderation.sql',
      '025-reports.sql',
      '026-notifications.sql',
    ];
    await runMigrations();
    const executed: string[] = query.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    // Câu vá users.role vẫn chạy dù câu CREATE EXTENSION lỗi.
    expect(
      executed.some((s) => s.includes('ADD COLUMN IF NOT EXISTS role')),
    ).toBe(true);
  });
});

describe('splitStatements', () => {
  it('keeps dollar-quoted function body as one statement', () => {
    const sql = `CREATE FUNCTION f() RETURNS trigger AS $$
BEGIN
  NEW.x := 1;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10);`;
    const parts = splitStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('RETURN NEW;');
    expect(parts[1]).toContain('ADD COLUMN IF NOT EXISTS role');
  });

  it('ignores semicolons inside strings and comments', () => {
    const sql = `-- comment; with semicolon
SELECT 'a;b'; /* block; comment */
SELECT 1;`;
    const parts = splitStatements(sql);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("'a;b'");
  });

  it('skips comment-only chunks', () => {
    expect(splitStatements('-- just a comment\n')).toHaveLength(0);
  });
});
