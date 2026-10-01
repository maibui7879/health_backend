import { LocalizationService } from './localization.service';

// Mock dùng chung cho unit test: t()/tIn() trả về key, lang() luôn 'vi'.
export const localizationMockProvider = {
  provide: LocalizationService,
  useValue: {
    t: (key: string) => key,
    tIn: (_lang: string, key: string) => key,
    lang: () => 'vi' as const,
  },
};
