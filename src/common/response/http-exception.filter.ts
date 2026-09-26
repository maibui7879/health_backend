import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { parseLocaleHeader, type AppLocale } from '../../i18n/locale';
import { LocalizationService } from '../../i18n/localization.service';

type HttpErrorPayload = {
  message?: string | string[];
};

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly i18n: LocalizationService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { locale?: AppLocale }>();
    // Filter chạy sync ngoài ALS → đọc locale đã ghim trên request.
    const lang: AppLocale =
      request.locale ??
      parseLocaleHeader(
        request.headers['x-locale'],
        request.headers['accept-language'],
      );

    if (!(exception instanceof HttpException)) {
      // Lỗi ngoài HttpException (lỗi lập trình, DB...): log stack + envelope 500.
      this.logger.error(
        `${request.method} ${request.url} 500 - Unexpected error`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          success: false,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: this.i18n.tIn(lang, 'common.internalError'),
          path: request.url,
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const payload =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as HttpErrorPayload)
        : null;

    const rawMessage =
      payload?.message ??
      (typeof exceptionResponse === 'string'
        ? exceptionResponse
        : exception.message);

    const message = Array.isArray(rawMessage)
      ? (rawMessage[0] ?? this.i18n.tIn(lang, 'common.genericError'))
      : typeof rawMessage === 'string'
        ? rawMessage
        : this.i18n.tIn(lang, 'common.genericError');

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
