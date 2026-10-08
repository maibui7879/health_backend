import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { LocalizationService } from '../../i18n/localization.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private readonly i18n: LocalizationService,
  ) {}

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const host =
      this.configService.get<string>('MAIL_HOST') ?? process.env.MAIL_HOST;
    const user =
      this.configService.get<string>('MAIL_USER') ?? process.env.MAIL_USER;
    const pass =
      this.configService.get<string>('MAIL_PASS') ?? process.env.MAIL_PASS;
    if (!host || !user || !pass) {
      this.logger.warn('MAIL_* chưa cấu hình — bỏ qua gửi mail.');
      return null;
    }
    const port = Number(
      this.configService.get<string>('MAIL_PORT') ??
        process.env.MAIL_PORT ??
        587,
    );
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // Fail nhanh thay vì treo ~2 phút mặc định của nodemailer
      // (SMTP bị chặn ở firewall sẽ timeout kết nối).
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    return this.transporter;
  }

  async sendOtp(to: string, code: string): Promise<boolean> {
    return this.send(to, 'mail.otpSubject', 'mail.otpBody', code);
  }

  async sendRegistrationOtp(to: string, code: string): Promise<boolean> {
    return this.send(
      to,
      'mail.registerOtpSubject',
      'mail.registerOtpBody',
      code,
    );
  }

  private async send(
    to: string,
    subjectKey: 'mail.otpSubject' | 'mail.registerOtpSubject',
    bodyKey: 'mail.otpBody' | 'mail.registerOtpBody',
    code: string,
  ): Promise<boolean> {
    const subject = this.i18n.t(subjectKey);
    const text = this.i18n.t(bodyKey, { code });
    const html = this.buildOtpHtml(text, code);
    // Ưu tiên email API qua HTTPS (qua được firewall chặn SMTP của HF).
    if (await this.sendViaResend(to, subject, text, html)) return true;
    if (await this.sendViaBrevo(to, subject, text, html)) return true;
    const transporter = this.getTransporter();
    if (!transporter) return false;
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      process.env.MAIL_FROM ??
      this.configService.get<string>('MAIL_USER') ??
      process.env.MAIL_USER ??
      '';
    try {
      await transporter.sendMail({ from, to, subject, text, html });
      return true;
    } catch (error) {
      this.logger.error(`Gửi OTP tới ${to} thất bại: ${String(error)}`);
      return false;
    }
  }

  // Template HTML branded (inline CSS để Gmail app render đúng).
  private buildOtpHtml(text: string, code: string): string {
    const title = this.i18n.t('mail.otpTitle');
    const footer = this.i18n.t('mail.footer');
    const digits = code
      .split('')
      .map(
        (d) =>
          `<td style="background:#F6F7F6;border-radius:12px;padding:12px 0;width:44px;text-align:center;font-size:24px;font-weight:800;color:#17281F;">${d}</td><td style="width:8px;"></td>`,
      )
      .join('');
    return `<div style="background:#F6F7F6;padding:24px 0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:20px;max-width:480px;width:100%;">
<tr><td align="center" style="padding:28px 24px 8px;">
<div style="width:56px;height:56px;border-radius:28px;background:#2E9E5B;color:#FFFFFF;font-size:28px;font-weight:800;line-height:56px;">B</div>
<div style="font-size:22px;font-weight:800;color:#17281F;margin-top:12px;">BeroHealth</div>
</td></tr>
<tr><td align="center" style="padding:8px 24px 0;font-size:16px;font-weight:700;color:#17281F;">${title}</td></tr>
<tr><td align="center" style="padding:16px 24px 0;">
<table cellpadding="0" cellspacing="0"><tr>${digits}</tr></table>
</td></tr>
<tr><td align="center" style="padding:16px 24px 0;font-size:13px;color:#6E8577;">${text}</td></tr>
<tr><td align="center" style="padding:20px 24px 28px;font-size:12px;color:#9AA5A0;">${footer}</td></tr>
</table>
</td></tr></table>
</div>`;
  }

  private async sendViaResend(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<boolean> {
    const apiKey =
      this.configService.get<string>('RESEND_API_KEY') ??
      process.env.RESEND_API_KEY;
    if (!apiKey) return false;
    const from =
      this.configService.get<string>('RESEND_FROM') ??
      process.env.RESEND_FROM ??
      'onboarding@resend.dev';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text, html }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.logger.error(
          `Resend từ chối (${res.status}): ${await res.text().catch(() => '')}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`Gửi OTP qua Resend thất bại: ${String(error)}`);
      return false;
    }
  }

  private async sendViaBrevo(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<boolean> {
    const apiKey =
      this.configService.get<string>('BREVO_API_KEY') ??
      process.env.BREVO_API_KEY;
    if (!apiKey) return false;
    const from =
      this.configService.get<string>('BREVO_FROM') ??
      process.env.BREVO_FROM ??
      this.configService.get<string>('MAIL_USER') ??
      process.env.MAIL_USER ??
      '';
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: from },
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        this.logger.error(
          `Brevo từ chối (${res.status}): ${await res.text().catch(() => '')}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`Gửi OTP qua Brevo thất bại: ${String(error)}`);
      return false;
    }
  }
}
