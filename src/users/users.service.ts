import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserAllergy } from './entities/user-allergy.entity';
import { UserSetting } from './entities/user-setting.entity';
import {
  ActivityLevel,
  GoalType,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserProfile) private profileRepo: Repository<UserProfile>,
    @InjectRepository(UserAllergy) private allergyRepo: Repository<UserAllergy>,
    @InjectRepository(UserSetting)
    private settingRepo: Repository<UserSetting>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        setting: true,
        allergies: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException('Không tìm thấy profile');
    }

    Object.assign(profile, dto);

    if (
      profile.height_cm &&
      profile.current_weight_kg &&
      profile.date_of_birth &&
      profile.gender
    ) {
      const dob = new Date(profile.date_of_birth);
      const age = new Date().getFullYear() - dob.getFullYear();

      let bmr =
        10 * profile.current_weight_kg + 6.25 * profile.height_cm - 5 * age;
      bmr += profile.gender === 'MALE' ? 5 : -161;

      const activityLevel =
        (profile.activity_level as ActivityLevel | undefined) ??
        ActivityLevel.SEDENTARY;
      const activityMultipliers: Record<ActivityLevel, number> = {
        [ActivityLevel.SEDENTARY]: 1.2,
        [ActivityLevel.LIGHT]: 1.375,
        [ActivityLevel.MODERATE]: 1.55,
        [ActivityLevel.ACTIVE]: 1.725,
      };

      const tdee = bmr * activityMultipliers[activityLevel];

      const goalType = profile.goal_type as GoalType | undefined;
      let adjustedTdee = tdee;
      if (goalType === GoalType.LOSE_WEIGHT) adjustedTdee -= 500;
      if (goalType === GoalType.GAIN_MUSCLE) adjustedTdee += 300;

      profile.daily_kcal_target = Math.round(adjustedTdee);
      profile.daily_water_target = Math.round(profile.current_weight_kg * 35);
    }

    return this.profileRepo.save(profile);
  }

  async updateAllergies(userId: string, allergies: string[]) {
    await this.allergyRepo.delete({ user_id: userId });

    const newAllergies = allergies.map((name) => {
      const allergy = new UserAllergy();
      allergy.user_id = userId;
      allergy.allergen_name = name;
      return allergy;
    });

    if (newAllergies.length > 0) {
      await this.allergyRepo.save(newAllergies);
    }

    return { message: 'Cập nhật dị ứng thành công' };
  }

  async updateSettings(userId: string, dto: UpdateSettingDto) {
    let setting = await this.settingRepo.findOne({ where: { user_id: userId } });

    if (!setting) {
      setting = this.settingRepo.create({ user_id: userId, ...dto });
    } else {
      Object.assign(setting, dto);
    }

    return this.settingRepo.save(setting);
  }

  async updateDeviceToken(userId: string, deviceToken: string) {
    await this.userRepo.update(userId, { device_token: deviceToken });
    return { message: 'Cập nhật Device Token thành công' };
  }

  async deleteAccount(userId: string) {
    await this.userRepo.delete(userId);
    return { message: 'Tài khoản và toàn bộ dữ liệu đã được xóa vĩnh viễn' };
  }
}
