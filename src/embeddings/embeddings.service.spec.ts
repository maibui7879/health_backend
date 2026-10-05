import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  const groqEmbed = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-key') },
        },
      ],
    }).compile();
    service = module.get<EmbeddingsService>(EmbeddingsService);
    (service as unknown as { groq: unknown }).groq = {
      embeddings: { create: groqEmbed },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('trả vector đúng thứ tự index', async () => {
    groqEmbed.mockResolvedValue({
      data: [
        { index: 1, embedding: [0.3, 0.4], object: 'embedding' },
        { index: 0, embedding: [0.1, 0.2], object: 'embedding' },
      ],
    });
    const res = await service.embed(['một', 'hai']);
    expect(res).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(groqEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'nomic-embed-text-v1_5',
        input: ['một', 'hai'],
      }),
    );
  });

  it('429 thì backoff thử lại rồi mới thành công', async () => {
    groqEmbed.mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce({
      data: [{ index: 0, embedding: [0.5], object: 'embedding' }],
    });
    const res = await service.embed(['phở']);
    expect(res).toEqual([[0.5]]);
    expect(groqEmbed).toHaveBeenCalledTimes(2);
  });

  it('hết retry thì ném lỗi', async () => {
    groqEmbed.mockRejectedValue({ status: 429 });
    await expect(service.embed(['phở'])).rejects.toMatchObject({
      status: 429,
    });
    expect(groqEmbed).toHaveBeenCalledTimes(5); // 1 + 4 retry
  }, 40000);
});
