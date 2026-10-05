import { InsightsService } from './insights.service';

// Mock dùng chung cho unit test các service có hook taste (fire-and-forget).
export const insightsMock = {
  recordMeal: jest.fn(),
  recordFavorite: jest.fn(),
  recordWorkout: jest.fn(),
  recordCommunityLike: jest.fn(),
  recordPlanSkipped: jest.fn(),
  recordChatMention: jest.fn(),
  getProfile: jest.fn(),
  decayTaste: jest.fn(),
  saveChatSummary: jest.fn(),
  tasteContextBlock: jest.fn(() => Promise.resolve('')),
};

export const insightsMockProvider = {
  provide: InsightsService,
  useValue: insightsMock,
};
