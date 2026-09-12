import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthProvider, User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, full_name } = registerDto;
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profile = new UserProfile();
    profile.full_name = full_name;

    const newUser = this.userRepository.create({
      email,
      password_hash: hashedPassword,
      auth_provider: AuthProvider.LOCAL,
      profile,
    });

    await this.userRepository.save(newUser);
    return this.generateToken(newUser);
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || user.auth_provider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    return this.generateToken(user);
  }

  async refresh(payload: RefreshTokenPayload) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Refresh token không hợp lệ.');
    }

    return this.generateToken(user);
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
