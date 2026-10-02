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

  it('search chuẩn hóa bỏ dấu, ILIKE trước + similarity vét sau', async () => {
    const likeQb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'f1' }]),
    };
    const fuzzyQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'f2' }]),
    };
    mockFoodRepo.createQueryBuilder
      .mockReturnValueOnce(likeQb)
      .mockReturnValueOnce(fuzzyQb);

    const res = await service.search({ q: 'Phở Bò', limit: 99 });

    // 'Phở Bò' -> 'pho bo' (bỏ dấu, thường, gộp khoảng trắng)
    expect(likeQb.where).toHaveBeenCalledWith('food.search_norm ILIKE :like', {
      like: '%pho bo%',
    });
    expect(likeQb.take).toHaveBeenCalledWith(50);
    expect(fuzzyQb.where).toHaveBeenCalledWith('food.search_norm % :norm', {
      norm: 'pho bo',
    });
    expect(fuzzyQb.take).toHaveBeenCalledWith(49);
    expect(res).toEqual([{ id: 'f1' }, { id: 'f2' }]);
  });

  it('search đủ limit ở vòng ILIKE thì không vét similarity', async () => {
    const likeQb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]),
    };
    mockFoodRepo.createQueryBuilder.mockReturnValue(likeQb);

    const res = await service.search({ q: 'cơm', limit: 2 });

    expect(res).toHaveLength(2);
    expect(mockFoodRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('search không q trả toàn catalog A-Z', async () => {
    mockFoodRepo.find = jest.fn().mockResolvedValue([]);
    await service.search({});
    expect(mockFoodRepo.find).toHaveBeenCalledWith({
      order: { food_name_vi: 'ASC' },
      take: 20,
    });
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
