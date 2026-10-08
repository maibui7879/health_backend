import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalizationService } from '../../i18n/localization.service';
import { User, UserRole } from '../../users/entities/user.entity';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  token_type: 'access';
  role: UserRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  token_type: 'access';
}

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    private readonly i18n: LocalizationService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ??
        process.env.JWT_SECRET ??
        'development-access-secret',
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.token_type !== 'access') {
      throw new UnauthorizedException(this.i18n.t('auth.invalidAccessToken'));
    }
    // Chặn session của tài khoản vừa bị BAN (không chờ token hết hạn).
    // Strategy cùng module AuthModule nên User repo resolve bình thường.
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status === 'BANNED') {
      throw new UnauthorizedException(this.i18n.t('auth.invalidAccessToken'));
    }

    return payload;
  }
}
