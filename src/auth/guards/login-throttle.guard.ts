import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { LocalizationService } from '../../i18n/localization.service';

type Bucket = { count: number; resetAt: number };

// Chống brute-force đăng nhập (đã kiểm chứng live: 8 lần sai liên tiếp đều
// chỉ trả 401, không hề có 429). Hai tầng chặn:
//  - theo (IP + email): 5 lần / 5 phút — chặn dò mật khẩu 1 tài khoản;
//  - theo IP: 60 lần / 5 phút — chặn quét hàng loạt email (enumeration),
//    vì attacker đổi email thì bucket email nào cũng riêng nhưng vẫn dính
//    giới hạn chung theo IP.
// Đếm cả lần thành công nên user thật chỉ login 1 lần/phiên không bị ảnh hưởng.
// Bộ đếm trong RAM — HF Space đang chạy 1 instance nên đủ; nếu sau này scale
// đa replica thì chuyển sang Redis/DB (giữ nguyên chữ ký guard).
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly perEmailAttempts = new Map<string, Bucket>();
  private readonly perIpAttempts = new Map<string, Bucket>();
  private readonly windowMs = 5 * 60_000;
  private readonly perEmailLimit = 5;
  private readonly perIpLimit = 60;
  private lastSweepAt = 0;

  constructor(private readonly i18n: LocalizationService) {}

  canActivate(context: ExecutionContext): boolean {
    // Request tối thiểu: express Request.body là `any` nên khai báo lại kiểu
    // hẹp để satisfies lint và đọc email an toàn.
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      body?: { email?: unknown };
    }>();
    const now = Date.now();
    this.sweep(now);

    // req.ip chỉ là IP thật khi main.ts bật trust proxy (app nằm sau proxy
    // của HF). Thiếu setting đó mọi request sẽ dùng chung 1 bucket IP.
    const ip = request.ip ?? 'unknown';
    const rawEmail = request.body?.email;
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    if (
      this.isOverLimit(this.perEmailAttempts, `${ip}|${email}`, now) ||
      this.isOverLimit(this.perIpAttempts, ip, now)
    ) {
      throw new HttpException(
        this.i18n.t('auth.tooManyAttempts', {
          minutes: Math.ceil(this.windowMs / 60_000),
        }),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.count(this.perEmailAttempts, `${ip}|${email}`, now);
    this.count(this.perIpAttempts, ip, now);
    return true;
  }

  // Cửa sổ cố định: quá hạn thì reset, còn hạn thì so số lượt với ngưỡng.
  private isOverLimit(
    buckets: Map<string, Bucket>,
    key: string,
    now: number,
  ): boolean {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return false;
    return bucket.count >= this.limitOf(buckets);
  }

  private count(buckets: Map<string, Bucket>, key: string, now: number): void {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    bucket.count += 1;
  }

  private limitOf(buckets: Map<string, Bucket>): number {
    return buckets === this.perEmailAttempts
      ? this.perEmailLimit
      : this.perIpLimit;
  }

  // Dọn bucket hết hạn định kỳ để Map không phình theo email attacker bịa.
  private sweep(now: number): void {
    if (now - this.lastSweepAt < this.windowMs) return;
    this.lastSweepAt = now;
    for (const [key, bucket] of this.perEmailAttempts) {
      if (bucket.resetAt <= now) this.perEmailAttempts.delete(key);
    }
    for (const [key, bucket] of this.perIpAttempts) {
      if (bucket.resetAt <= now) this.perIpAttempts.delete(key);
    }
  }
}
