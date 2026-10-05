import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityType } from './entities/workout.entity';
import { ExerciseTemplate } from './entities/exercise-template.entity';
import { ExerciseTemplatesService } from './exercise-templates.service';
import { localizationMockProvider } from '../i18n/localization.mock';

describe('ExerciseTemplatesService', () => {
  let service: ExerciseTemplatesService;
  const mockRepo = { find: jest.fn(), findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseTemplatesService,
        localizationMockProvider,
        { provide: getRepositoryToken(ExerciseTemplate), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<ExerciseTemplatesService>(ExerciseTemplatesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('list chỉ trả template active, lọc theo activity', async () => {
    mockRepo.find.mockResolvedValue([]);
    await service.list(ActivityType.YOGA);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { is_active: true, activity_type: ActivityType.YOGA },
      order: { code: 'ASC' },
    });
  });

  it('getByCode 404 khi không có hoặc inactive', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.getByCode('NOPE')).rejects.toThrow();
    mockRepo.findOne.mockResolvedValueOnce({ code: 'X', is_active: false });
    await expect(service.getByCode('X')).rejects.toThrow();
  });
});
