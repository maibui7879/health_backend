import { Injectable } from '@nestjs/common';
import { en } from './dictionaries/en';
import { vi, type TranslationKey } from './dictionaries/vi';
import { currentLocale } from './locale-storage';
import type { AppLocale } from './locale';

const dicts: Record<AppLocale, Record<TranslationKey, string>> = { vi, en };

export function t(
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  return translate(currentLocale(), key, vars);
}

export function translate(
  lang: AppLocale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = dicts[lang][key] ?? vi[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : m,
  );
}

@Injectable()
export class LocalizationService {
  lang(): AppLocale {
    return currentLocale();
  }

  t(key: TranslationKey, vars?: Record<string, string | number>): string {
    return t(key, vars);
  }

  tIn(
    lang: AppLocale,
    key: TranslationKey,
    vars?: Record<string, string | number>,
  ): string {
    return translate(lang, key, vars);
  }
}
