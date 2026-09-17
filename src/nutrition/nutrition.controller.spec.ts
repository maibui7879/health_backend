import { Test, TestingModule } from '@nestjs/testing';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';

describe('NutritionController', () => {
  let controller: NutritionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NutritionController],
      providers: [
        {
          provide: NutritionService,
          useValue: {
            createMeal: jest.fn(),
            getDailyDashboard: jest.fn(),
            searchHistory: jest.fn(),
            deleteMeal: jest.fn(),
            getWeeklyStats: jest.fn(),
            getMacroTargets: jest.fn(),
            getNutritionSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NutritionController>(NutritionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
