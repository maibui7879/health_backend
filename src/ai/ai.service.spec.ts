import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { localizationMockProvider } from '../i18n/localization.mock';
import { NutritionPlansService } from '../nutrition/plans.service';
import { UsersService } from '../users/users.service';

describe('AiService', () => {
  let service: AiService;
  const groqCreate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        localizationMockProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-groq-key'),
          },
        },
        { provide: NutritionPlansService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    (service as unknown as { groq: unknown }).groq = {
      chat: { completions: { create: groqCreate } },
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('reviewDay parses Groq JSON review', async () => {
    const review = {
      overall_comment: 'Good day, 95% of planned kcal.',
      meal_comments: [{ meal_type: 'LUNCH', comment: 'Balanced.' }],
      workout_comment: 'Completed as planned.',
      suggestions: ['Keep it up tomorrow.'],
      warning: null,
    };
    groqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(review) } }],
      usage: { total_tokens: 120 },
    });

    const result = await service.reviewDay({
      userName: 'An',
      allergies: [],
      dietType: 'STANDARD',
      goalType: 'MAINTAIN',
      adherence: { verdict: 'ON_TRACK', scores: { overall: 95 } },
      lang: 'vi',
    });

    expect(result).toMatchObject({
      overall_comment: expect.stringContaining('Good day') as string,
      warning: null,
    });
    expect(groqCreate).toHaveBeenCalledTimes(1);
  });

  it('reviewDay maps Groq 429 to 429 sau 3 lần thử', async () => {
    groqCreate.mockRejectedValue({ status: 429 });
    await expect(
      service.reviewDay({
        userName: 'An',
        allergies: [],
        dietType: 'STANDARD',
        goalType: 'MAINTAIN',
        adherence: {},
        lang: 'en',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(groqCreate).toHaveBeenCalledTimes(3);
  }, 30000);

  it('reviewDay thử lại 1 lần 429 rồi thành công', async () => {
    groqCreate
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({
        choices: [
          { message: { content: JSON.stringify({ overall_comment: 'ok', warning: null }) } },
        ],
      });
    const result = await service.reviewDay({
      userName: 'An',
      allergies: [],
      dietType: 'STANDARD',
      goalType: 'MAINTAIN',
      adherence: {},
      lang: 'vi',
    });
    expect(result).toMatchObject({ overall_comment: 'ok' });
    expect(groqCreate).toHaveBeenCalledTimes(2);
  }, 30000);

  it('suggestMenu chèn tasteContext RAG vào prompt (Phase 8)', async () => {
    groqCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              meal_type: 'LUNCH',
              total_kcal: 600,
              items: [],
            }),
          },
        },
      ],
    });
    await service.suggestMenu({
      kcalTarget: 600,
      tasteContext: 'Sở thích ngầm: Hay ăn/quan tâm: gà.',
    });
    const call = groqCreate.mock.calls[0] as
      [{ messages: { content: string }[] }] | undefined;
    const prompt = call?.[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('Hay ăn/quan tâm: gà.');
  });

  it('suggestPlan chèn tasteContext vào từng chunk (Phase 8)', async () => {
    groqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ days: [] }) } }],
    });
    await service.suggestPlan({
      durationDays: 2,
      tasteContext: 'Sở thích ngầm: Hay tập: RUNNING.',
    });
    expect(groqCreate).toHaveBeenCalledTimes(1);
    const call = groqCreate.mock.calls[0] as
      [{ messages: { content: string }[] }] | undefined;
    const prompt = call?.[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('Hay tập: RUNNING.');
  });
});
