import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

// Embeddings qua Groq (model nomic-embed-text-v1_5, 768 chiều) — chung
// GROQ_API_KEY, không thêm vendor. Dùng cho semantic-search + backfill.
// Batch + backoff 429 (Groq tier thấp hay 429 như chat).

const EMBEDDING_MODEL = 'nomic-embed-text-v1_5';
const BATCH_SIZE = 64;
const MAX_RETRIES = 4;

function isRateLimit(error: unknown): boolean {
  const status =
    (error as { status?: number })?.status ??
    (error as { statusCode?: number })?.statusCode;
  const code =
    (error as { code?: string })?.code ??
    (error as { error?: { code?: string } })?.error?.code;
  return status === 429 || code === 'rate_limit_exceeded';
}

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private groq: Groq;

  constructor(private configService: ConfigService) {
    this.groq = new Groq({
      apiKey: this.configService.get<string>('GROQ_API_KEY'),
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts
        .slice(i, i + BATCH_SIZE)
        .map((t) => t.trim().slice(0, 2000) || ' ');
      out.push(...(await this.embedBatch(batch)));
    }
    return out;
  }

  private async embedBatch(batch: string[]): Promise<number[][]> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await this.groq.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batch,
          encoding_format: 'float',
        });
        return res.data
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((d) => d.embedding as number[]);
      } catch (error) {
        if (!isRateLimit(error) || attempt >= MAX_RETRIES) throw error;
        const wait = Math.min(30000, 1000 * 2 ** attempt);
        this.logger.warn(
          `Embeddings 429, thử lại sau ${wait}ms (lần ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
      }
    }
  }
}
