// Nạp embedding Phase 8 cho bảng foods (chạy tay 1 lần sau deploy,
// chạy lại an toàn vì chỉ nạp hàng còn thiếu).
// Usage: node scripts/backfill-food-embeddings.cjs [--limit 100]
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const BATCH = 32;
const MAX_RETRIES = 5;

function loadEnv(p) {
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(groq, batch, attempt = 0) {
  try {
    const res = await groq.embeddings.create({
      model: 'nomic-embed-text-v1_5',
      input: batch,
      encoding_format: 'float',
    });
    return res.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  } catch (e) {
    const rateLimited = e?.status === 429 || e?.code === 'rate_limit_exceeded';
    if (!rateLimited || attempt >= MAX_RETRIES) throw e;
    const wait = Math.min(60000, 2000 * 2 ** attempt);
    console.log(`429 — chờ ${wait}ms (lần ${attempt + 1})`);
    await sleep(wait);
    return embedBatch(groq, batch, attempt + 1);
  }
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const cap = limitArg ? Number(limitArg.split('=')[1]) || Infinity : Infinity;
  const { default: Groq } = await import('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let done = 0;
  for (;;) {
    const { rows } = await client.query(
      `SELECT id, food_name_vi, food_name_en FROM foods
       WHERE embedding IS NULL ORDER BY food_name_vi LIMIT ${BATCH}`,
    );
    if (rows.length === 0 || done >= cap) break;
    const texts = rows.map(
      (r) => `${r.food_name_vi ?? ''} ${r.food_name_en ?? ''}`.trim(),
    );
    const vectors = await embedBatch(groq, texts);
    for (let i = 0; i < rows.length && done < cap; i++) {
      await client.query('UPDATE foods SET embedding = $1 WHERE id = $2', [
        `[${vectors[i].join(',')}]`,
        rows[i].id,
      ]);
      done++;
    }
    console.log(`OK: ${done} foods`);
  }
  await client.end();
  console.log(`XONG: nạp ${done} embeddings.`);
}

main().catch((e) => {
  console.error('BACKFILL_FAILED:', e.message);
  process.exit(1);
});
