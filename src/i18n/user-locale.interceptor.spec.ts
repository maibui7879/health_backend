import { of } from 'rxjs';
import { UserLocaleInterceptor } from './user-locale.interceptor';

function mockContext(user?: { sub?: string }) {
  const req: Record<string, unknown> = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    req,
  } as never;
}

const next = { handle: () => of('ok') } as never;

describe('UserLocaleInterceptor', () => {
  it('locale null (chưa chọn) → ép vi', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ locale: null }) };
    const i = new UserLocaleInterceptor(repo as never);
    const ctx = mockContext({ sub: 'u1' });
    await i.intercept(ctx, next);
    expect((ctx.req as { locale?: string }).locale).toBe('vi');
    expect(repo.findOne).toHaveBeenCalled();
  });

  it('locale đã lưu en → giữ en', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ locale: 'en' }) };
    const i = new UserLocaleInterceptor(repo as never);
    const ctx = mockContext({ sub: 'u1' });
    await i.intercept(ctx, next);
    expect((ctx.req as { locale?: string }).locale).toBe('en');
  });

  it('DB lỗi → không ghim, rơi về header', async () => {
    const repo = {
      findOne: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const i = new UserLocaleInterceptor(repo as never);
    const ctx = mockContext({ sub: 'u1' });
    await i.intercept(ctx, next);
    expect((ctx.req as { locale?: string }).locale).toBeUndefined();
  });

  it('chưa login → bỏ qua, không query', async () => {
    const repo = { findOne: jest.fn() };
    const i = new UserLocaleInterceptor(repo as never);
    await i.intercept(mockContext(undefined), next);
    expect(repo.findOne).not.toHaveBeenCalled();
  });
});
