import { MEDICAL_MARKER, buildSystemPrompt } from '../ai/ai-chat.system';
import { en } from './dictionaries/en';
import { vi } from './dictionaries/vi';
import { parseLocaleHeader } from './locale';
import { localeStorage } from './locale-storage';
import { t } from './localization.service';

describe('i18n', () => {
  it('en đủ key với vi (parity)', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort());
  });

  it('parse X-Locale ưu tiên hơn Accept-Language', () => {
    expect(parseLocaleHeader('en', 'vi')).toBe('en');
    expect(parseLocaleHeader('  en  ', '')).toBe('en');
    expect(parseLocaleHeader(undefined, 'en-US,en;q=0.9')).toBe('en');
    expect(parseLocaleHeader(undefined, 'vi-VN,vi;q=0.9')).toBe('vi');
    expect(parseLocaleHeader(undefined, 'fr-FR')).toBe('vi');
    expect(parseLocaleHeader(undefined, undefined)).toBe('vi');
    expect(parseLocaleHeader('de', 'en')).toBe('en');
  });

  it('t() dịch theo locale hiện tại, fallback vi', () => {
    expect(localeStorage.run('vi', () => t('auth.emailInUse'))).toBe(
      vi['auth.emailInUse'],
    );
    expect(localeStorage.run('en', () => t('auth.emailInUse'))).toBe(
      en['auth.emailInUse'],
    );
    expect(t('auth.emailInUse')).toBe(vi['auth.emailInUse']);
  });

  it('marker y tế khác nhau mỗi locale', () => {
    expect(MEDICAL_MARKER.vi).toBe('[CẢNH BÁO Y TẾ]');
    expect(MEDICAL_MARKER.en).toBe('[MEDICAL WARNING]');
    const ctx = {
      displayName: 'An',
      profileLine: '',
      allergyLine: '',
      kcalLine: '',
      macroLine: '',
      goalType: 'MAINTAIN',
      today: '2026-09-26',
    };
    expect(buildSystemPrompt(ctx, 'vi')).toContain(MEDICAL_MARKER.vi);
    expect(buildSystemPrompt(ctx, 'en')).toContain(MEDICAL_MARKER.en);
  });
});
