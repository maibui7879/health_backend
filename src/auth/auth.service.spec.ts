import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthProvider, User } from '../users/entities/user.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { RegistrationOtp } from './entities/registration-otp.entity';
import { MailService } from '../common/mail/mail.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { localizationMockProvider } from '../i18n/localization.mock';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockOtpRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockRegistrationOtpRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockMailService = {
    sendOtp: jest.fn(),
    sendRegistrationOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        localizationMockProvider,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(PasswordResetOtp),
          useValue: mockOtpRepository,
        },
        {
          provide: getRepositoryToken(RegistrationOtp),
          useValue: mockRegistrationOtpRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
      };
      const hashedPassword = 'hashedPassword123';
      const mockUser = { id: 'user-id', email: registerDto.email };

      mockUserRepository.findOne.mockResolvedValue(null); // User does not exist
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      const expectedCreateArg: {
        email: string;
        profile: { full_name: string };
        setting: unknown;
      } = {
        email: registerDto.email,
        profile: { full_name: 'Test User' },
        setting: expect.anything(),
      };
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(expectedCreateArg),
      );
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user_id).toEqual('user-id');
    });

    it('should throw ConflictException if email already exists', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password',
        full_name: 'Test',
      };
      mockUserRepository.findOne.mockResolvedValue({ id: 'existing-id' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login successfully and return tokens', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' };
      const mockUser = {
        id: 'user-id',
        email: loginDto.email,
        password_hash: 'hashedPassword',
        auth_provider: AuthProvider.LOCAL,
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.login(loginDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password_hash,
      );
      expect(result).toHaveProperty('access_token');
    });

    it('should throw UnauthorizedException on wrong credentials', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrong' };
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('should generate new tokens if refresh token is valid', async () => {
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        token_type: 'refresh' as const,
      };
      const mockUser = { id: 'user-id', email: 'test@example.com' };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-token');

      const result = await service.refresh(payload);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
      expect(result).toHaveProperty('access_token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        token_type: 'refresh' as const,
      };
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('should update password when current password matches', async () => {
      const mockUser = {
        id: 'user-id',
        auth_provider: AuthProvider.LOCAL,
        password_hash: 'old-hash',
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.changePassword('user-id', {
        current_password: 'old123',
        new_password: 'new12345',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('old123', 'old-hash');
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: 'new-hash' }),
      );
      expect(result).toHaveProperty('message');
    });

    it('should throw BadRequestException on wrong current password', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        auth_provider: AuthProvider.LOCAL,
        password_hash: 'old-hash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-id', {
          current_password: 'wrong',
          new_password: 'new12345',
        }),
      ).rejects.toThrow('auth.currentPasswordWrong');
    });

    it('should throw BadRequestException for Google users', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        auth_provider: AuthProvider.GOOGLE,
        password_hash: null,
      });

      await expect(
        service.changePassword('user-id', {
          current_password: 'x',
          new_password: 'new12345',
        }),
      ).rejects.toThrow('auth.googleNoPassword');
    });
  });

  describe('forgotPassword', () => {
    it('should create OTP and send mail for local users', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        auth_provider: AuthProvider.LOCAL,
      });
      mockOtpRepository.findOne.mockResolvedValue(null);
      mockOtpRepository.create.mockImplementation(
        (v: Record<string, unknown>) => v,
      );
      mockOtpRepository.save.mockResolvedValue({ id: 'otp-id' });
      mockOtpRepository.update.mockResolvedValue({ affected: 0 });
      mockMailService.sendOtp.mockResolvedValue(true);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(mockOtpRepository.save).toHaveBeenCalled();
      expect(mockMailService.sendOtp).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
      expect(result).toHaveProperty('message');
    });

    it('should return generic message without sending for unknown email', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(mockMailService.sendOtp).not.toHaveBeenCalled();
      expect(result).toHaveProperty('message');
    });

    it('should reject when recent OTP still in cooldown', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        auth_provider: AuthProvider.LOCAL,
      });
      mockOtpRepository.findOne.mockResolvedValue({
        created_at: new Date(),
      });

      await expect(
        service.forgotPassword({ email: 'test@example.com' }),
      ).rejects.toThrow('auth.otpTooFrequent');
    });
  });

  describe('resetPassword', () => {
    it('should reset password on valid OTP', async () => {
      const codeHash = createHash('sha256').update('123456').digest('hex');
      mockOtpRepository.findOne.mockResolvedValue({
        id: 'otp-id',
        code_hash: codeHash,
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() + 600_000),
      });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        auth_provider: AuthProvider.LOCAL,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      mockOtpRepository.save.mockResolvedValue({});
      mockUserRepository.save.mockResolvedValue({});

      const result = await service.resetPassword({
        email: 'test@example.com',
        otp: '123456',
        new_password: 'new12345',
      });

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ password_hash: 'new-hash' }),
      );
      expect(result).toHaveProperty('message');
    });

    it('should reject wrong OTP and count attempt', async () => {
      const otp = {
        id: 'otp-id',
        code_hash: 'other-hash',
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() + 600_000),
      };
      mockOtpRepository.findOne.mockResolvedValue(otp);
      mockOtpRepository.save.mockResolvedValue(otp);

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          otp: '000000',
          new_password: 'new12345',
        }),
      ).rejects.toThrow('auth.otpInvalid');
      expect(otp.attempts).toBe(1);
    });

    it('should reject expired OTP', async () => {
      mockOtpRepository.findOne.mockResolvedValue({
        id: 'otp-id',
        code_hash: 'x',
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() - 1000),
      });
      mockOtpRepository.save.mockResolvedValue({});

      await expect(
        service.resetPassword({
          email: 'test@example.com',
          otp: '123456',
          new_password: 'new12345',
        }),
      ).rejects.toThrow('auth.otpExpired');
    });
  });

  describe('registerRequestOtp', () => {
    const dto = {
      full_name: 'New User',
      email: 'new@example.com',
      password: 'secret123',
    };

    it('should store pending registration and send OTP', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockRegistrationOtpRepository.findOne.mockResolvedValue(null);
      mockRegistrationOtpRepository.create.mockImplementation(
        (v: Record<string, unknown>) => v,
      );
      mockRegistrationOtpRepository.save.mockResolvedValue({ id: 'r1' });
      mockRegistrationOtpRepository.update.mockResolvedValue({});
      mockMailService.sendRegistrationOtp.mockResolvedValue(true);

      const result = await service.registerRequestOtp(dto);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockRegistrationOtpRepository.save).toHaveBeenCalled();
      expect(mockMailService.sendRegistrationOtp).toHaveBeenCalledWith(
        'new@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
      expect(result).toHaveProperty('message');
    });

    it('should throw ConflictException if email already used', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 'u1' });

      await expect(service.registerRequestOtp(dto)).rejects.toThrow(
        'auth.emailInUse',
      );
      expect(mockRegistrationOtpRepository.save).not.toHaveBeenCalled();
    });

    it('should reject when recent OTP still in cooldown', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockRegistrationOtpRepository.findOne.mockResolvedValue({
        created_at: new Date(),
      });

      await expect(service.registerRequestOtp(dto)).rejects.toThrow(
        'auth.otpTooFrequent',
      );
    });
  });

  describe('registerVerifyOtp', () => {
    it('should create user and return tokens on valid OTP', async () => {
      const codeHash = createHash('sha256').update('654321').digest('hex');
      mockRegistrationOtpRepository.findOne.mockResolvedValue({
        id: 'r1',
        email: 'new@example.com',
        full_name: 'New User',
        password_hash: 'hashed-pw',
        code_hash: codeHash,
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() + 600_000),
      });
      mockUserRepository.findOne.mockResolvedValue(null);
      const mockUser = { id: 'new-id', email: 'new@example.com' };
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockRegistrationOtpRepository.save.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.registerVerifyOtp({
        email: 'new@example.com',
        otp: '654321',
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
      expect(result.user_id).toEqual('new-id');
    });

    it('should reject wrong OTP and count attempt', async () => {
      const pending = {
        id: 'r1',
        code_hash: 'other-hash',
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() + 600_000),
      };
      mockRegistrationOtpRepository.findOne.mockResolvedValue(pending);
      mockRegistrationOtpRepository.save.mockResolvedValue(pending);

      await expect(
        service.registerVerifyOtp({ email: 'new@example.com', otp: '000000' }),
      ).rejects.toThrow('auth.otpInvalid');
      expect(pending.attempts).toBe(1);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should reject when email got registered meanwhile', async () => {
      const codeHash = createHash('sha256').update('654321').digest('hex');
      const pending = {
        id: 'r1',
        email: 'new@example.com',
        full_name: 'New User',
        password_hash: 'hashed-pw',
        code_hash: codeHash,
        attempts: 0,
        used: false,
        expires_at: new Date(Date.now() + 600_000),
      };
      mockRegistrationOtpRepository.findOne.mockResolvedValue(pending);
      mockUserRepository.findOne.mockResolvedValue({ id: 'u-taken' });
      mockRegistrationOtpRepository.save.mockResolvedValue(pending);

      await expect(
        service.registerVerifyOtp({ email: 'new@example.com', otp: '654321' }),
      ).rejects.toThrow('auth.emailInUse');
      expect(pending.used).toBe(true);
    });
  });
});
