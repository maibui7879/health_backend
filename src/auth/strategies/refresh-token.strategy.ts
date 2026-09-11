import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  token_type: 'refresh';
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => request?.body?.refresh_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? 'development-refresh-secret',
    });
  }

  validate(payload: RefreshTokenPayload) {
    if (payload.token_type !== 'refresh') {
      throw new UnauthorizedException('Refresh token không hợp lệ.');
    }

    return payload;
  }
}