import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { NutritionService } from '../nutrition/nutrition.service';
import { DailyLog } from '../tracking/entities/daily-log.entity';
import { UsersService } from '../users/users.service';
import { Workout } from '../workout/entities/workout.entity';
import { AiChatService } from './ai-chat.service';
import {
  buildSuggestedQuestions,
  buildSystemPrompt,
  CHAT_HISTORY_LIMIT,
} from './ai-chat.system';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('AiChatService', () => {
  let service: AiChatService;
  const msgFind = jest.fn();
  const msgCreate = jest.fn((v: unknown) => v);
  const msgSave = jest.fn((v: unknown) => Promise.resolve({ id: 'm1', ...v }));
  const convCreate = jest.fn((v: unknown) => v);
  const convSave = jest.fn((v) => Promise.resolve({ id: 'c1', ...v }));

  const groqCreate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        localizationMockProvider,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-key') },
        },
        {
          provide: getRepositoryToken(AiConversation),
          useValue: {
            create: convCreate,
            save: convSave,
            findOne: jest.fn().mockResolvedValue(null),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            update: jest.fn().mockResolvedValue({}),
            remove: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getRepositoryToken(AiMessage),
          useValue: {
            create: msgCreate,
            save: msgSave,
            find: msgFind.mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(DailyLog),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Workout),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: UsersService,
          useValue: {
            getMe: jest.fn().mockResolvedValue({
              profile: {
                full_name: 'Test',
                goal_type: 'LOSE_WEIGHT',
                diet_type: 'STANDARD',
                daily_kcal_target: 1800,
              },
              allergies: [],
            }),
          },
        },
        {
          provide: NutritionService,
          useValue: {
            getDailyDashboard: jest.fn().mockResolvedValue({ total_kcal: 500 }),
            getMacroTargets: jest.fn().mockRejectedValue(new Error('no')),
          },
        },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    (service as unknown as { groq: unknown }).groq = {
      chat: { completions: { create: groqCreate } },
    };
    groqCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Ăn ức gà + rau luộc nhé',
            tool_calls: undefined,
          },
        },
      ],
      usage: { total_tokens: 42 },
    });
  });

  it('service được khởi tạo', () => {
    expect(service).toBeDefined();
  });

  it('system prompt chứa chuỗi cảnh báo y tế cứng', () => {
    const prompt = buildSystemPrompt({
      displayName: 'An',
      profileLine: '25 tuổi',
      allergyLine: 'Không dị ứng.',
      kcalLine: 'Còn 500 kcal.',
      macroLine: '',
      goalType: 'MAINTAIN',
      today: '2026-09-26',
    });
    expect(prompt).toContain('[CẢNH BÁO Y TẾ]');
  });

  it('sliding window giới hạn 6 tin nhắn', () => {
    expect(CHAT_HISTORY_LIMIT).toBe(6);
  });

  it('gợi ý 3 câu hỏi', () => {
    expect(buildSuggestedQuestions('reply', 'LOSE_WEIGHT')).toHaveLength(3);
  });

  it('chat tạo hội thoại mới và trả reply', async () => {
    const result = await service.chat('u1', { message: 'Tối nay ăn gì?' });
    expect(result.conversation_id).toBe('c1');
    expect(result.reply).toContain('ức gà');
    expect(result.suggested_questions).toHaveLength(3);
    expect(groqCreate).toHaveBeenCalledTimes(1);
    expect(msgSave).toHaveBeenCalledTimes(2); // user + assistant
  });

  it('429 được ném thành 429 retryable', async () => {
    groqCreate.mockRejectedValue({ status: 429 });
    await expect(service.chat('u1', { message: 'hi' })).rejects.toMatchObject({
      status: 429,
    });
    // user msg vẫn được lưu dù AI lỗi
    expect(msgSave).toHaveBeenCalledTimes(1);
  });
});
