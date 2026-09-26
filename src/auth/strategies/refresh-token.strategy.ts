import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { LocalizationService } from '../../i18n/localization.service';

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  token_type: 'refresh';
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly i18n: LocalizationService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (
          request: { body?: { refresh_token?: string } } | undefined,
        ): string | null => request?.body?.refresh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_REFRESH_SECRET ??
        process.env.JWT_SECRET ??
        'development-refresh-secret',
    });
  }

  validate(payload: RefreshTokenPayload) {
    if (payload.token_type !== 'refresh') {
      throw new UnauthorizedException(this.i18n.t('auth.invalidRefreshToken'));
    }

    return payload;
  }
}
