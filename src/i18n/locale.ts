export const APP_LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const FALLBACK_LOCALE: AppLocale = 'vi';

export function isAppLocale(v: unknown): v is AppLocale {
  return v === 'vi' || v === 'en';
}

// X-Locale được ưu tiên (mobile chủ động gửi), sau đó Accept-Language.
export function parseLocaleHeader(
  xLocale: unknown,
  acceptLanguage: unknown,
): AppLocale {
  const x = typeof xLocale === 'string' ? xLocale.trim() : '';
  if (isAppLocale(x)) {
    return x;
  }
  if (typeof acceptLanguage === 'string') {
    for (const part of acceptLanguage.split(',')) {
      const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
      if (tag === 'en' || tag.startsWith('en-')) return 'en';
      if (tag === 'vi' || tag.startsWith('vi-')) return 'vi';
    }
  }
  return FALLBACK_LOCALE;
}
