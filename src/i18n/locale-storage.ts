import { AsyncLocalStorage } from 'async_hooks';
import type { AppLocale } from './locale';
import { FALLBACK_LOCALE } from './locale';

// Locale của request hiện tại. Middleware set từ header,
// interceptor nâng cấp lên user.setting.locale khi đã auth.
export const localeStorage = new AsyncLocalStorage<AppLocale>();

export function currentLocale(): AppLocale {
  return localeStorage.getStore() ?? FALLBACK_LOCALE;
}
