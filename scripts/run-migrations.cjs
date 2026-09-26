// Chạy migration SQL tay (dùng 1 lần, xóa sau khi xong).
// Usage: node scripts/run-migrations.cjs
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
  for (const f of ['001-ai-chat.sql', '002-user-locale.sql']) {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', f),
      'utf8',
    );
    await client.query(sql);
    console.log('OK:', f);
  }
  await client.end();
}

main().catch((e) => {
  console.error('MIGRATION_FAILED:', e.message);
  process.exit(1);
});
