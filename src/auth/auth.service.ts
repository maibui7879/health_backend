import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { AuthProvider, User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { UserSetting } from '../users/entities/user-setting.entity';
import { MailService } from '../common/mail/mail.service';
import { LocalizationService } from '../i18n/localization.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterRequestOtpDto } from './dto/register-request-otp.dto';
import { RegisterVerifyOtpDto } from './dto/register-verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { RegistrationOtp } from './entities/registration-otp.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client(
    process.env.GOOGLE_WEB_CLIENT_ID,
  );

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepository: Repository<PasswordResetOtp>,
    @InjectRepository(RegistrationOtp)
    private readonly registrationOtpRepository: Repository<RegistrationOtp>,
    private readonly jwtService: JwtService,
    private readonly i18n: LocalizationService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, full_name } = registerDto;
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException(this.i18n.t('auth.emailInUse'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = this.buildLocalUser(email, hashedPassword, full_name);

    await this.userRepository.save(newUser);
    return this.generateToken(newUser);
  }

  // Tạo user LOCAL kèm profile + setting mặc định (chưa lưu DB).
  private buildLocalUser(
    email: string,
    hashedPassword: string,
    fullName: string,
  ) {
    const profile = new UserProfile();
    profile.full_name = fullName;
    // Khởi tạo setting với defaults của entity (DB columns có default).
    const setting = new UserSetting();
    return this.userRepository.create({
      email,
      password_hash: hashedPassword,
      auth_provider: AuthProvider.LOCAL,
      profile,
      setting,
    });
  }

  // Bước 1 đăng ký 2 bước: kiểm tra email, lưu thông tin chờ + gửi OTP.
  // Chưa tạo user thật cho tới khi verify OTP thành công.
  async registerRequestOtp(dto: RegisterRequestOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(this.i18n.t('auth.emailInUse'));
    }

    const recent = await this.registrationOtpRepository.findOne({
      where: { email, used: false },
      order: { created_at: 'DESC' },
    });
    if (
      recent &&
      Date.now() - recent.created_at.getTime() <
        AuthService.OTP_RESEND_SECONDS * 1000
    ) {
      throw new HttpException(
        this.i18n.t('auth.otpTooFrequent'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.registrationOtpRepository.update(
      { email, used: false },
      { used: true },
    );

    const code = String(randomInt(100000, 1000000)).padStart(6, '0');
    const pending = this.registrationOtpRepository.create({
      email,
      full_name: dto.full_name.trim(),
      password_hash: await bcrypt.hash(dto.password, 10),
      code_hash: AuthService.hashOtp(code),
      expires_at: new Date(
        Date.now() + AuthService.OTP_TTL_MINUTES * 60 * 1000,
      ),
    });
    await this.registrationOtpRepository.save(pending);
    await this.mailService.sendRegistrationOtp(email, code);
    return { message: this.i18n.t('auth.registerOtpSent') };
  }

  // Bước 2: đúng OTP → tạo user thật + trả token (khỏi đăng nhập lại).
  async registerVerifyOtp(dto: RegisterVerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const pending = await this.registrationOtpRepository.findOne({
      where: { email, used: false },
      order: { created_at: 'DESC' },
    });
    if (!pending) {
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    if (pending.attempts >= AuthService.OTP_MAX_ATTEMPTS) {
      pending.used = true;
      await this.registrationOtpRepository.save(pending);
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    if (pending.expires_at.getTime() < Date.now()) {
      pending.used = true;
      await this.registrationOtpRepository.save(pending);
      throw new BadRequestException(this.i18n.t('auth.otpExpired'));
    }
    if (pending.code_hash !== AuthService.hashOtp(dto.otp)) {
      pending.attempts += 1;
      await this.registrationOtpRepository.save(pending);
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    // Chống race: email bị đăng ký xen giữa lúc chờ OTP.
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      pending.used = true;
      await this.registrationOtpRepository.save(pending);
      throw new ConflictException(this.i18n.t('auth.emailInUse'));
    }

    const newUser = this.buildLocalUser(
      email,
      pending.password_hash,
      pending.full_name,
    );
    await this.userRepository.save(newUser);
    pending.used = true;
    await this.registrationOtpRepository.save(pending);
    return this.generateToken(newUser);
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || user.auth_provider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'));
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'));
    }

    return this.generateToken(user);
  }

  async refresh(payload: RefreshTokenPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidRefreshToken'));
    }

    return this.generateToken(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'));
    }
    if (user.auth_provider !== AuthProvider.LOCAL || !user.password_hash) {
      throw new BadRequestException(this.i18n.t('auth.googleNoPassword'));
    }
    const ok = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!ok) {
      throw new BadRequestException(this.i18n.t('auth.currentPasswordWrong'));
    }
    user.password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.userRepository.save(user);
    return { message: this.i18n.t('auth.passwordChanged') };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    // Luôn trả message chung để không lộ email nào đã đăng ký.
    // Chỉ gửi OTP cho tài khoản LOCAL (Google login không dùng mật khẩu).
    if (user && user.auth_provider === AuthProvider.LOCAL) {
      const recent = await this.otpRepository.findOne({
        where: { email, used: false },
        order: { created_at: 'DESC' },
      });
      if (
        recent &&
        Date.now() - recent.created_at.getTime() <
          AuthService.OTP_RESEND_SECONDS * 1000
      ) {
        throw new HttpException(
          this.i18n.t('auth.otpTooFrequent'),
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // Vô hiệu OTP cũ chưa dùng để mỗi lúc chỉ 1 mã hiệu lực.
      await this.otpRepository.update({ email, used: false }, { used: true });

      const code = String(randomInt(100000, 1000000)).padStart(6, '0');
      const otp = this.otpRepository.create({
        email,
        code_hash: AuthService.hashOtp(code),
        expires_at: new Date(
          Date.now() + AuthService.OTP_TTL_MINUTES * 60 * 1000,
        ),
      });
      await this.otpRepository.save(otp);
      await this.mailService.sendOtp(email, code);
    }
    return { message: this.i18n.t('auth.otpSent') };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = await this.otpRepository.findOne({
      where: { email, used: false },
      order: { created_at: 'DESC' },
    });
    if (!otp) {
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    if (otp.attempts >= AuthService.OTP_MAX_ATTEMPTS) {
      otp.used = true;
      await this.otpRepository.save(otp);
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    if (otp.expires_at.getTime() < Date.now()) {
      otp.used = true;
      await this.otpRepository.save(otp);
      throw new BadRequestException(this.i18n.t('auth.otpExpired'));
    }
    if (otp.code_hash !== AuthService.hashOtp(dto.otp)) {
      otp.attempts += 1;
      await this.otpRepository.save(otp);
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.auth_provider !== AuthProvider.LOCAL) {
      otp.used = true;
      await this.otpRepository.save(otp);
      throw new BadRequestException(this.i18n.t('auth.otpInvalid'));
    }
    user.password_hash = await bcrypt.hash(dto.new_password, 10);
    await this.userRepository.save(user);
    otp.used = true;
    await this.otpRepository.save(otp);
    return { message: this.i18n.t('auth.passwordResetDone') };
  }

  private static hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private static readonly OTP_TTL_MINUTES = 10;
  private static readonly OTP_MAX_ATTEMPTS = 5;
  private static readonly OTP_RESEND_SECONDS = 60;

  async verifyGoogleLogin(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException(this.i18n.t('auth.invalidGoogleToken'));
      }

      const { email, name, picture } = payload;
      let user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        const profile = new UserProfile();
        profile.full_name = name || 'Google User';
        profile.avatar_url = picture || '';
        const setting = new UserSetting();

        user = this.userRepository.create({
          email,
          auth_provider: AuthProvider.GOOGLE,
          profile,
          setting,
        });
        await this.userRepository.save(user);
      }

      return this.generateToken(user);
    } catch (error) {
      console.error('LỖI XÁC THỰC GOOGLE:', error);
      throw new UnauthorizedException(this.i18n.t('auth.googleTokenExpired'));
    }
  }

  private generateToken(user: User) {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(
        { ...payload, token_type: 'access' },
        {
          secret:
            process.env.JWT_ACCESS_SECRET ??
            process.env.JWT_SECRET ??
            'development-access-secret',
          expiresIn: '7d',
        },
      ),
      refresh_token: this.jwtService.sign(
        { ...payload, token_type: 'refresh' },
        {
          secret:
            process.env.JWT_REFRESH_SECRET ??
            process.env.JWT_SECRET ??
            'development-refresh-secret',
          expiresIn: '30d',
        },
      ),
      user_id: user.id,
    };
  }
}
