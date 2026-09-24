import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_KEYS = ['password', 'token', 'refresh_token', 'authorization'];

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    if (process.env.LOG_REQUEST_BODY === 'true') {
      this.logger.debug(
        `→ ${method} ${originalUrl} body=${JSON.stringify(sanitizeBody(request.body))}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
          );
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `${method} ${originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms - ${message}`,
          );
        },
      }),
    );
  }
}
