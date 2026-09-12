import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as bcrypt from 'bcrypt';
import * as fs from 'node:fs';
import * as path from 'node:path';
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

  private initializeFirebase() {
    const firebaseKeyPath = path.resolve(
      process.cwd(),
      'firebase-admin-key.json',
    );

    if (!fs.existsSync(firebaseKeyPath)) {
      throw new Error(
        `Missing Firebase Admin SDK key file at: ${firebaseKeyPath}. Please provide firebase-admin-key.json before using Firebase login.`,
      );
    }

    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(
        fs.readFileSync(firebaseKeyPath, 'utf8'),
      ) as Record<string, string>;

      initializeApp({
        credential: cert(serviceAccount),
      });
    }
  }

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

  async verifyFirebaseToken(idToken: string) {
    try {
      this.initializeFirebase();
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const { email, name, picture } = decodedToken;

      if (!email) {
        throw new UnauthorizedException('Không tìm thấy email trong token');
      }

      let user: User | null = await this.userRepository.findOne({
        where: { email },
      });

      if (!user) {
        const profile = new UserProfile();
        profile.full_name = name || 'Firebase User';
        profile.avatar_url = picture || '';

        const createdUser = this.userRepository.create({
          email,
          auth_provider: AuthProvider.GOOGLE,
          profile,
        });

        user = createdUser;
        await this.userRepository.save(user);
      }

      return this.generateToken(user);
    } catch (error) {
      console.error('🔥 LỖI THỰC SỰ TỪ FIREBASE:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message.includes('Missing Firebase Admin SDK key file')
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'Firebase ID Token không hợp lệ hoặc đã hết hạn.',
      );
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
