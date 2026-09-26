import { LocalizationService } from './localization.service';

// Mock dùng chung cho unit test: t() trả về key, lang() luôn 'vi'.
export const localizationMockProvider = {
  provide: LocalizationService,
  useValue: {
    t: (key: string) => key,
    lang: () => 'vi' as const,
  },
};
