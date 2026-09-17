import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

type HttpErrorPayload = {
  message?: string | string[];
};

@Injectable()
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

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

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
