import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { localizationMockProvider } from '../i18n/localization.mock';

function ctx(userId?: string) {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { sub: userId } : undefined }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const mockUserRepo = { findOne: jest.fn() };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        localizationMockProvider,
        { provide: Reflector, useValue: reflector },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();
    guard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('route không gắn @Roles thì qua', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx('u1'))).resolves.toBe(true);
  });

  it('ADMIN qua, USER bị 403', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    mockUserRepo.findOne.mockResolvedValue({ id: 'a1', role: UserRole.ADMIN });
    await expect(guard.canActivate(ctx('a1'))).resolves.toBe(true);

    mockUserRepo.findOne.mockResolvedValue({ id: 'u1', role: UserRole.USER });
    await expect(guard.canActivate(ctx('u1'))).rejects.toThrow();
  });

  it('chưa login nhường AuthGuard', async () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
    expect(mockUserRepo.findOne).not.toHaveBeenCalled();
  });
});
