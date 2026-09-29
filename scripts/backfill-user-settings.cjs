// Backfill user_settings mặc định cho user chưa có row.
// Idempotent — chạy lại nhiều lần an toàn.
// Usage: node scripts/backfill-user-settings.cjs
const path = require('path');
const { Client } = require('pg');

function loadEnv(p) {
  const fs = require('fs');
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const before = await client.query(
    `SELECT COUNT(*)::int AS n FROM users u
     LEFT JOIN user_settings s ON s.user_id = u.id
     WHERE s.user_id IS NULL`,
  );
  console.log('Users missing settings:', before.rows[0].n);

  const res = await client.query(
    `INSERT INTO user_settings
       (user_id, remind_water, water_interval_mins, remind_meals, meal_times, locale, updated_at)
     SELECT u.id, TRUE, 120, TRUE, NULL, 'vi', now()
     FROM users u
     LEFT JOIN user_settings s ON s.user_id = u.id
     WHERE s.user_id IS NULL
     RETURNING user_id`,
  );
  console.log('Backfilled rows:', res.rowCount);
  await client.end();
}

main().catch((e) => {
  console.error('BACKFILL_FAILED:', e.message);
  process.exit(1);
});
