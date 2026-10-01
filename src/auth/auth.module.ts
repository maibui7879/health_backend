import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { RegistrationOtp } from './entities/registration-otp.entity';
import { User } from '../users/entities/user.entity';
import { MailService } from '../common/mail/mail.service';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetOtp, RegistrationOtp]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'development-secret',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
  exports: [AccessTokenStrategy, RefreshTokenStrategy],
})
export class AuthModule {}
