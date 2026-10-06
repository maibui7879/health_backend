import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../../i18n/localization.service';
import { User, UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Chặn route theo role. Đọc role tươi từ DB (không tin JWT cũ khi vừa
// promote/demote). Route không gắn @Roles thì qua.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly i18n: LocalizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest() as {
      user?: { sub?: string };
    };
    const userId = req.user?.sub;
    if (!userId) return true; // nhường AuthGuard trả 401
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(this.i18n.t('auth.forbidden'));
    }
    return true;
  }
}
