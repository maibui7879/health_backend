import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { parseLocaleHeader, type AppLocale } from '../../i18n/locale';
import { LocalizationService } from '../../i18n/localization.service';

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  unknown
> {
  constructor(private readonly i18n: LocalizationService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { locale?: AppLocale }>();
    // Đọc sync từ request (interceptor đã ghim), không qua ALS vì map()
    // chạy ở subscription-time.
    const lang: AppLocale =
      request.locale ??
      parseLocaleHeader(
        request.headers['x-locale'],
        request.headers['accept-language'],
      );
    const statusCode = response.statusCode;
    const method = request.method;

    return next.handle().pipe(
      map((data: unknown) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          statusCode,
          message:
            method === 'POST'
              ? this.i18n.tIn(lang, 'common.created')
              : method === 'PUT' || method === 'PATCH'
                ? this.i18n.tIn(lang, 'common.updated')
                : method === 'DELETE'
                  ? this.i18n.tIn(lang, 'common.deleted')
                  : this.i18n.tIn(lang, 'common.fetched'),
          data: data ?? null,
        };
      }),
    );
  }
}
