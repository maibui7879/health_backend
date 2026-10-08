import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LocalizationService } from '../../i18n/localization.service';
import { UserRole } from '../../users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Chặn route theo role đọc từ JWT (không query DB mỗi request).
// Role mới có hiệu lực khi login/refresh cấp token mới (refresh luôn
// đọc role tươi từ DB). Route không gắn @Roles thì qua.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly i18n: LocalizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest() as {
      user?: { sub?: string; role?: string };
    };
    const role = req.user?.role;
    if (!role) return true; // nhường AuthGuard trả 401
    if (!required.includes(role as UserRole)) {
      throw new ForbiddenException(this.i18n.t('auth.forbidden'));
    }
    return true;
  }
}
