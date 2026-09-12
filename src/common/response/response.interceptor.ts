import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response?.statusCode ?? 200;

        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'statusCode' in data &&
          'message' in data
        ) {
          return data;
        }

        return {
          success: true,
          statusCode,
          message: this.getMessage(context, statusCode),
          data: data ?? null,
        };
      }),
    );
  }

  private getMessage(context: ExecutionContext, statusCode: number): string {
    const req = context.switchToHttp().getRequest();
    const method = req?.method?.toUpperCase();

    if (statusCode >= 200 && statusCode < 300) {
      if (method === 'POST') {
        return 'Tạo dữ liệu thành công';
      }
      if (method === 'PUT' || method === 'PATCH') {
        return 'Cập nhật dữ liệu thành công';
      }
      if (method === 'DELETE') {
        return 'Xóa dữ liệu thành công';
      }
      return 'Lấy dữ liệu thành công';
    }

    return 'Yêu cầu không thành công';
  }
}
