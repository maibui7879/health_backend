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

type HttpErrorPayload = {
  message?: string | string[];
};

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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
          message: 'Lỗi hệ thống, vui lòng thử lại sau.',
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
      ? (rawMessage[0] ?? 'Có lỗi xảy ra')
      : typeof rawMessage === 'string'
        ? rawMessage
        : 'Có lỗi xảy ra';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status} - ${message}`);
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
