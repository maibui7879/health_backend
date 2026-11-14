import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserAllergy } from './entities/user-allergy.entity';
import { UserSetting } from './entities/user-setting.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { LocalizationService } from '../i18n/localization.service';
import { bmiCategory, calcBmi } from './bmi';
import { healthMetrics } from './health-metrics';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserProfile) private profileRepo: Repository<UserProfile>,
    @InjectRepository(UserAllergy) private allergyRepo: Repository<UserAllergy>,
    @InjectRepository(UserSetting)
    private settingRepo: Repository<UserSetting>,
    private readonly i18n: LocalizationService,
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
      throw new NotFoundException(this.i18n.t('users.notFound'));
    }

    // Không bao giờ trả password_hash ra API
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...safeUser } = user;
    // BMI tính lúc đọc (không lưu DB): chỉ gắn khi đủ số liệu để
    // không đổi shape response của user chưa nhập chiều cao/cân nặng.
    const bmi = calcBmi(
      user.profile?.height_cm,
      user.profile?.current_weight_kg,
    );
    if (bmi === null || !user.profile) {
      return safeUser;
    }
    return {
      ...safeUser,
      profile: {
        ...user.profile,
        ...healthMetrics(user.profile),
        bmi,
        bmi_category: bmiCategory(bmi),
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException(this.i18n.t('users.profileNotFound'));
    }

    // Bỏ key undefined (class-transformer tạo đủ props) để partial update
    // không ghi đè các field khác thành null.
    for (const key of Object.keys(dto) as (keyof UpdateProfileDto)[]) {
      if (dto[key] === undefined) delete dto[key];
    }
    Object.assign(profile, dto);
    if (profile.date_of_birth && new Date(profile.date_of_birth) > new Date()) {
      throw new BadRequestException('Ngày sinh không được ở tương lai.');
    }
    const metrics = healthMetrics(profile);
    profile.bmr = metrics.bmr;
    profile.tdee = metrics.tdee;
    profile.daily_kcal_target = metrics.daily_kcal_target as number;
    profile.daily_water_target = metrics.daily_water_target as number;

    return this.profileRepo.save(profile);
  }

  async updateAvatar(userId: string, filename: string) {
    const profile = await this.profileRepo.findOne({
      where: { user_id: userId },
    });

    if (!profile) {
      throw new NotFoundException(this.i18n.t('users.profileNotFound'));
    }

    // Xóa file avatar local cũ (nếu có) để khỏi rác disk.
    const oldUrl = profile.avatar_url ?? '';
    if (oldUrl.startsWith('/uploads/')) {
      const uploadDir =
        process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
      await unlink(join(uploadDir, oldUrl.replace('/uploads/', ''))).catch(
        () => undefined,
      );
    }

    profile.avatar_url = `/uploads/avatars/${filename}`;
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

    return { message: this.i18n.t('users.allergiesUpdated') };
  }

  async updateSettings(userId: string, dto: UpdateSettingDto) {
    let setting = await this.settingRepo.findOne({
      where: { user_id: userId },
    });

    if (!setting) {
      setting = this.settingRepo.create({ user_id: userId, ...dto });
    } else {
      for (const key of Object.keys(dto) as (keyof UpdateSettingDto)[]) {
        if (dto[key] === undefined) delete dto[key];
      }
      Object.assign(setting, dto);
    }

    if (
      (setting.water_start_time ?? '11:00') >=
      (setting.water_end_time ?? '20:30')
    ) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc.');
    }
    if (
      dto.meal_times &&
      Object.entries(dto.meal_times).some(
        ([key, value]) =>
          !['breakfast', 'lunch', 'dinner'].includes(key) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(value),
      )
    ) {
      throw new BadRequestException('Giờ ăn không hợp lệ.');
    }

    return this.settingRepo.save(setting);
  }

  async getSettings(userId: string) {
    const setting = await this.settingRepo.findOne({
      where: { user_id: userId },
    });

    // Chưa từng lưu settings → trả defaults khớp entity, không 404
    // để mobile luôn có locale dùng ngay.
    return (
      setting ?? {
        user_id: userId,
        remind_water: true,
        water_interval_mins: 120,
        remind_meals: true,
        meal_times: null,
        locale: 'vi',
        show_water: true,
        show_calories: true,
        show_workout: true,
        water_start_time: '11:00',
        water_end_time: '20:30',
      }
    );
  }

  async updateLocale(userId: string, locale: string) {
    return this.updateSettings(userId, { locale });
  }

  async updateDeviceToken(userId: string, deviceToken: string) {
    await this.userRepo.update(userId, { device_token: deviceToken });
    return { message: this.i18n.t('users.deviceTokenUpdated') };
  }

  async deleteAccount(userId: string) {
    await this.userRepo.delete(userId);
    return { message: this.i18n.t('users.accountDeleted') };
  }
}
