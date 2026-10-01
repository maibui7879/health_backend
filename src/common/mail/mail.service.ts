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
    const transporter = this.getTransporter();
    if (!transporter) return false;
    const from =
      this.configService.get<string>('MAIL_FROM') ??
      process.env.MAIL_FROM ??
      this.configService.get<string>('MAIL_USER') ??
      process.env.MAIL_USER ??
      '';
    try {
      await transporter.sendMail({
        from,
        to,
        subject: this.i18n.t(subjectKey),
        text: this.i18n.t(bodyKey, { code }),
      });
      return true;
    } catch (error) {
      this.logger.error(`Gửi OTP tới ${to} thất bại: ${String(error)}`);
      return false;
    }
  }
}
