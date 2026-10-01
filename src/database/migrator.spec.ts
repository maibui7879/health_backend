import { Client } from 'pg';
import { runMigrations } from './migrator';

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
    const aiIndex = executed.findIndex((s) => s.includes('ai_conversations'));
    const localeIndex = executed.findIndex((s) => s.includes('ADD COLUMN'));
    expect(aiIndex).toBeGreaterThanOrEqual(0);
    expect(localeIndex).toBeGreaterThan(aiIndex);
    const inserts = executed.filter((s) =>
      s.startsWith('INSERT INTO schema_migrations'),
    );
    expect(inserts).toHaveLength(10);
    // Repair luôn chạy sau cùng kể cả khi không còn migration nào.
    expect(executed[executed.length - 1]).toContain('password_reset_otps');
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
    ];
    await runMigrations();
    const executed: string[] = query.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(
      executed.some((s) => s.startsWith('INSERT INTO schema_migrations')),
    ).toBe(false);
    // Repair chạy mỗi lần boot để tự vá schema bị sửa từ bên ngoài.
    expect(executed[executed.length - 1]).toContain('password_reset_otps');
  });

  it('uses SSL for non-local databases', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@remote.host:5432/db';
    await runMigrations();
    expect(MockClient).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: { rejectUnauthorized: false } }),
    );
  });
});
