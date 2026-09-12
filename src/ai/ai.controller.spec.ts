import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { UsersService } from '../users/users.service';

describe('AiController', () => {
  let controller: AiController;

  beforeEach(async () => {
    const aiServiceMock: Partial<AiService> = {
      analyzeFoodImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
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
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
