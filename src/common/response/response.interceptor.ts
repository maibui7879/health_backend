import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  unknown
> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
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
              ? 'Tạo dữ liệu thành công'
              : method === 'PUT' || method === 'PATCH'
                ? 'Cập nhật dữ liệu thành công'
                : method === 'DELETE'
                  ? 'Xóa dữ liệu thành công'
                  : 'Lấy dữ liệu thành công',
          data: data ?? null,
        };
      }),
    );
  }
}
