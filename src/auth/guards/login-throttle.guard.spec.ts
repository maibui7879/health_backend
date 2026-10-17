import { HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';
import { LoginThrottleGuard } from './login-throttle.guard';
import { localizationMockProvider } from '../../i18n/localization.mock';
import { LocalizationService } from '../../i18n/localization.service';

describe('LoginThrottleGuard', () => {
  let guard: LoginThrottleGuard;

  // Giả lập request có body.email và req.ip (express set khi bật trust proxy).
  const makeContext = (ip: string, email?: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ ip, body: email === undefined ? {} : { email } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    // LocalizationService mock trả về key — không cần i18n thật cho unit test.
    const i18n = localizationMockProvider.useValue as LocalizationService;
    guard = new LoginThrottleGuard(i18n);
  });

  it('cho phép các lần thử đầu tiên', () => {
    expect(guard.canActivate(makeContext('1.1.1.1', 'a@b.com'))).toBe(true);
    expect(guard.canActivate(makeContext('1.1.1.1', 'a@b.com'))).toBe(true);
  });

  it('chặn lần thử thứ 6 theo cùng (IP + email) trong 5 phút', () => {
    for (let i = 0; i < 5; i++) {
      expect(guard.canActivate(makeContext('1.1.1.1', 'a@b.com'))).toBe(true);
    }
    let caught: unknown;
    try {
      guard.canActivate(makeContext('1.1.1.1', 'a@b.com'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('không chặn khi đổi email (mỗi email có bucket riêng)', () => {
    for (let i = 0; i < 5; i++) {
      guard.canActivate(makeContext('1.1.1.1', 'a@b.com'));
    }
    // Email khác từ cùng IP vẫn qua (chưa vượt giới hạn IP).
    expect(guard.canActivate(makeContext('1.1.1.1', 'c@d.com'))).toBe(true);
  });

  it('chặn khi một IP dùng hàng loạt email khác nhau (giới hạn IP)', () => {
    for (let i = 0; i < 60; i++) {
      guard.canActivate(makeContext('2.2.2.2', `user${i}@b.com`));
    }
    // Email đầu tiên vẫn dính giới hạn IP dù bucket email của nó còn chỗ.
    let caught: unknown;
    try {
      guard.canActivate(makeContext('2.2.2.2', 'fresh@b.com'));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('tách biệt theo IP: IP khác không bị ảnh hưởng', () => {
    for (let i = 0; i < 5; i++) {
      guard.canActivate(makeContext('3.3.3.3', 'a@b.com'));
    }
    expect(() => guard.canActivate(makeContext('3.3.3.3', 'a@b.com'))).toThrow(
      HttpException,
    );
    expect(guard.canActivate(makeContext('4.4.4.4', 'a@b.com'))).toBe(true);
  });

  it('hết cửa sổ 5 phút thì cho thử lại', () => {
    jest.useFakeTimers({ now: 1_000_000 });
    try {
      for (let i = 0; i < 5; i++) {
        guard.canActivate(makeContext('5.5.5.5', 'a@b.com'));
      }
      expect(() =>
        guard.canActivate(makeContext('5.5.5.5', 'a@b.com')),
      ).toThrow(HttpException);
      // Nhảy qua cửa sổ 5 phút: bucket hết hạn → đếm lại từ đầu.
      jest.setSystemTime(1_000_000 + 5 * 60_000 + 1);
      expect(guard.canActivate(makeContext('5.5.5.5', 'a@b.com'))).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('không ném lỗi khi thiếu body.email (request hỏng vẫn đi tiếp)', () => {
    expect(guard.canActivate(makeContext('6.6.6.6'))).toBe(true);
  });
});
