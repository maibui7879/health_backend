// Kiểm tra schema sau migrate (dùng 1 lần).
// Usage: node scripts/check-schema.cjs
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(p) {
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const cols = await client.query(
    `SELECT table_name, column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_name IN ('user_settings','ai_conversations','ai_messages')
     ORDER BY table_name, ordinal_position`,
  );
  const tables = {};
  for (const r of cols.rows) {
    tables[r.table_name] = tables[r.table_name] || [];
    tables[r.table_name].push(`${r.column_name}:${r.data_type}`);
  }
  console.log(JSON.stringify(tables, null, 1));
  const tablesOnly = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public'
     AND tablename IN ('user_settings','ai_conversations','ai_messages')`,
  );
  console.log(
    'TABLES:',
    tablesOnly.rows.map((r) => r.tablename).join(','),
  );
  await client.end();
}

main().catch((e) => {
  console.error('CHECK_FAILED:', e.message);
  process.exit(1);
});
