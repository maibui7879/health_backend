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

// Sau guard: nếu user đã lưu locale trong settings thì ưu tiên hơn header.
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
        if (isAppLocale(saved)) {
          // Ghim vào request: response interceptor + exception filter đọc ở
          // subscription-time (ngoài ALS) vẫn thấy locale đúng.
          req.locale = saved;
          return localeStorage.run(saved, () => next.handle());
        }
      } catch {
        // DB lỗi thì giữ locale từ header, không chặn request.
      }
    }
    return next.handle();
  }
}
