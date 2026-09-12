import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof errorResponse === 'object' && errorResponse !== null
        ? (errorResponse as any).message ?? 'Có lỗi xảy ra'
        : exception instanceof Error
          ? exception.message
          : 'Có lỗi xảy ra';

    response.status(status).json({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      data: null,
      errors:
        typeof errorResponse === 'object' && errorResponse !== null
          ? (errorResponse as any).errors ?? errorResponse
          : undefined,
    });
  }
}
