import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('AiController', () => {
  let controller: AiController;

  beforeEach(async () => {
    const aiServiceMock: Partial<AiService> = {
      analyzeFoodImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        localizationMockProvider,
        {
          provide: AiService,
          useValue: aiServiceMock,
        },
        {
          provide: UsersService,
          useValue: {
            getMe: jest.fn(),
          },
        },
        {
          provide: NutritionService,
          useValue: {
            getDailyDashboard: jest.fn(),
            getMacroTargets: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
