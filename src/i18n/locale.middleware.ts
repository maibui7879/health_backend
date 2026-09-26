import type { NextFunction, Request, Response } from 'express';
import { parseLocaleHeader } from './locale';
import { localeStorage } from './locale-storage';

// Chạy trước guards/pipes: ValidationPipe cũng thấy locale từ header.
export function localeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const lang = parseLocaleHeader(
    req.headers['x-locale'],
    req.headers['accept-language'],
  );
  localeStorage.run(lang, () => next());
}
