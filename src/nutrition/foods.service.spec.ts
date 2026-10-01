import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { localizationMockProvider } from '../i18n/localization.mock';
import { FavoriteFood } from './entities/favorite-food.entity';
import { Food } from './entities/food.entity';
import { FavoritesService } from './favorites.service';
import { FoodsService } from './foods.service';

describe('FoodsService', () => {
  let service: FoodsService;
  const mockFoodRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodsService,
        localizationMockProvider,
        { provide: getRepositoryToken(Food), useValue: mockFoodRepo },
      ],
    }).compile();
    service = module.get<FoodsService>(FoodsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('search giới hạn tối đa 50 và tìm theo tên', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ food_name_vi: 'Phở bò' }]),
    };
    mockFoodRepo.createQueryBuilder.mockReturnValue(qb);

    const res = await service.search({ q: 'phở', limit: 99 });

    expect(qb.take).toHaveBeenCalledWith(50);
    expect(qb.where).toHaveBeenCalledWith(
      '(food.food_name_vi ILIKE :q OR food.food_name_en ILIKE :q)',
      { q: '%phở%' },
    );
    expect(res).toHaveLength(1);
  });

  it('getById 404 khi không có', async () => {
    mockFoodRepo.findOne.mockResolvedValue(null);
    await expect(service.getById('nope')).rejects.toThrow(NotFoundException);
  });
});

describe('FavoritesService', () => {
  let service: FavoritesService;
  const mockFavRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockFoodRepo = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        localizationMockProvider,
        { provide: getRepositoryToken(FavoriteFood), useValue: mockFavRepo },
        { provide: getRepositoryToken(Food), useValue: mockFoodRepo },
      ],
    }).compile();
    service = module.get<FavoritesService>(FavoritesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lưu từ catalog kèm snapshot', async () => {
    const food = {
      id: 'f1',
      food_name_vi: 'Phở bò',
      food_name_en: 'Beef pho',
      kcal_100g: 95,
      protein_100g: 6.5,
      carbs_100g: 12,
      fat_100g: 2.5,
    };
    mockFoodRepo.findOne.mockResolvedValue(food);
    mockFavRepo.findOne.mockResolvedValue(null);
    mockFavRepo.create.mockImplementation((v: Record<string, unknown>) => v);
    mockFavRepo.save.mockImplementation((v: Record<string, unknown>) =>
      Promise.resolve({ id: 'fav1', ...v }),
    );

    const res = await service.create('u1', { food_id: 'f1' });

    expect(mockFavRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', food_id: 'f1' }),
    );
    expect(res.favorite).toMatchObject({ food_name_vi: 'Phở bò' });
  });

  it('409 khi đã yêu thích món đó', async () => {
    mockFoodRepo.findOne.mockResolvedValue({ id: 'f1' });
    mockFavRepo.findOne.mockResolvedValue({ id: 'fav1' });

    await expect(service.create('u1', { food_id: 'f1' })).rejects.toThrow(
      ConflictException,
    );
    expect(mockFavRepo.save).not.toHaveBeenCalled();
  });

  it('400 khi món tự nhập thiếu tên', async () => {
    await expect(service.create('u1', {})).rejects.toThrow(
      'favorites.nameRequired',
    );
  });

  it('xóa của người khác bị 403', async () => {
    mockFavRepo.findOne.mockResolvedValue({ id: 'f1', user_id: 'other' });
    await expect(service.remove('u1', 'f1')).rejects.toThrow(
      'favorites.forbidden',
    );
    expect(mockFavRepo.remove).not.toHaveBeenCalled();
  });
});
