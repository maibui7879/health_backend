import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { localizationMockProvider } from '../i18n/localization.mock';

function ctx(role?: string) {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { sub: 'u1', role } : undefined }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        localizationMockProvider,
        { provide: Reflector, useValue: reflector },
        // Guard đọc role từ JWT, không cần User repo.
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();
    guard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('route không gắn @Roles thì qua', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx('USER'))).resolves.toBe(true);
  });

  it('ADMIN qua, USER bị 403', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    await expect(guard.canActivate(ctx('ADMIN'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx('USER'))).rejects.toThrow();
  });

  it('chưa login nhường AuthGuard', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
  });
});
