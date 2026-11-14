const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Keep migration statements unchanged, but let the verification own the transaction.
const migration = fs.readFileSync(path.join(root, 'src/database/migrations/027-mvp-health.sql'), 'utf8')
  .replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, '');
const fixture = fs.readFileSync(path.join(root, 'test/mvp-migration.sql'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/wellness/wellness.service.ts'), 'utf8');
const statsQuery = service.match(/query<DailyStats\[\]>\(\s*`([\s\S]*?)`/);
if (!statsQuery) throw new Error('Cannot locate the actual statistics query');
fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
fs.writeFileSync(path.join(root, '.cache/mvp-verification.sql'), fixture
  .replaceAll('-- @MVP_MIGRATION@', () => migration)
  .replace('-- @STATS_QUERY@', () => `PREPARE mvp_stats(uuid, date, date) AS ${statsQuery[1]};
EXECUTE mvp_stats('00000000-0000-4000-8000-000000000001', current_date - 6, current_date);`));
console.log('Prepared .cache/mvp-verification.sql; all test data is rolled back.');
