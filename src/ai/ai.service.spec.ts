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

  it('reviewDay maps Groq 429 to 429', async () => {
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
  });
});
