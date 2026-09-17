import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserAllergy } from './entities/user-allergy.entity';
import { UserSetting } from './entities/user-setting.entity';
import {
  ActivityLevel,
  GoalType,
  UpdateProfileDto,
} from './dto/update-profile.dto';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockProfileRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockAllergyRepo = { delete: jest.fn(), save: jest.fn() };
  const mockSettingRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserProfile), useValue: mockProfileRepo },
        { provide: getRepositoryToken(UserAllergy), useValue: mockAllergyRepo },
        { provide: getRepositoryToken(UserSetting), useValue: mockSettingRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMe', () => {
    it('should return user with relations if found', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe('user-id');

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        relations: { profile: true, setting: true, allergies: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe('user-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException if profile not found', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);
      await expect(service.updateProfile('user-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update profile and calculate TDEE/Water correctly if all metrics provided', async () => {
      const mockProfile = { user_id: 'user-id' };
      const updateDto: UpdateProfileDto = {
        height_cm: 170,
        current_weight_kg: 70,
        date_of_birth: '1995-01-01',
        gender: 'MALE',
        activity_level: ActivityLevel.MODERATE,
        goal_type: GoalType.LOSE_WEIGHT,
      };

      mockProfileRepo.findOne.mockResolvedValue(mockProfile);
      mockProfileRepo.save.mockImplementation(
        (profile: Record<string, unknown>) => Promise.resolve(profile),
      );

      const result = await service.updateProfile('user-id', updateDto);

      expect(result.height_cm).toEqual(170);
      expect(result.daily_water_target).toEqual(70 * 35); // Water target logic
      expect(result.daily_kcal_target).toBeDefined();
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });

    it('should just update without calculations if metrics are missing', async () => {
      const mockProfile = { user_id: 'user-id' };
      const updateDto: UpdateProfileDto = { height_cm: 170 }; // missing weight/gender/dob

      mockProfileRepo.findOne.mockResolvedValue(mockProfile);
      mockProfileRepo.save.mockImplementation(
        (profile: Record<string, unknown>) => Promise.resolve(profile),
      );

      const result = await service.updateProfile('user-id', updateDto);

      expect(result.height_cm).toEqual(170);
      expect(result.daily_kcal_target).toBeUndefined(); // shouldn't calculate
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateAllergies', () => {
    it('should clear old allergies and save new ones', async () => {
      const allergies = ['sữa', 'đậu phộng'];
      mockAllergyRepo.delete.mockResolvedValue({ affected: 2 });
      mockAllergyRepo.save.mockResolvedValue([]);

      const result = await service.updateAllergies('user-id', allergies);

      expect(mockAllergyRepo.delete).toHaveBeenCalledWith({
        user_id: 'user-id',
      });
      expect(mockAllergyRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('message');
    });

    it('should clear old allergies and not save if array is empty', async () => {
      mockAllergyRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.updateAllergies('user-id', []);

      expect(mockAllergyRepo.delete).toHaveBeenCalledWith({
        user_id: 'user-id',
      });
      expect(mockAllergyRepo.save).not.toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });
  });
});
