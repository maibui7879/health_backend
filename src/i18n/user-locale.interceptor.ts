import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { UserSetting } from '../users/entities/user-setting.entity';
import { isAppLocale, type AppLocale } from './locale';
import { localeStorage } from './locale-storage';

type AuthedRequest = {
  user?: { sub?: string };
  locale?: AppLocale;
  localeOverridden?: boolean;
};

// Sau guard: user đã login thì locale = settings.locale, null (chưa từng
// chọn) thì ép 'vi'. Chỉ khi DB lỗi mới rơi về header.
@Injectable()
export class UserLocaleInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(UserSetting)
    private settingRepo: Repository<UserSetting>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const sub = req.user?.sub;
    if (sub && !req.localeOverridden) {
      req.localeOverridden = true;
      try {
        const setting = await this.settingRepo.findOne({
          where: { user_id: sub },
          select: { locale: true },
        });
        const saved = setting?.locale;
        const lang: AppLocale = isAppLocale(saved) ? saved : 'vi';
        // Ghim vào request: response interceptor + exception filter đọc ở
        // subscription-time (ngoài ALS) vẫn thấy locale đúng.
        req.locale = lang;
        return localeStorage.run(lang, () => next.handle());
      } catch {
        // DB lỗi thì giữ locale từ header, không chặn request.
      }
    }
    return next.handle();
  }
}
