import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { LocalizationService } from '../../i18n/localization.service';

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
  constructor(private readonly i18n: LocalizationService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ??
        process.env.JWT_SECRET ??
        'development-access-secret',
    });
  }

  validate(payload: AccessTokenPayload) {
    if (payload.token_type !== 'access') {
      throw new UnauthorizedException(this.i18n.t('auth.invalidAccessToken'));
    }

    return payload;
  }
}
