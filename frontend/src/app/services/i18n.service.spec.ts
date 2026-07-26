import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(I18nService);
  });

  it('should be created with default British English language', () => {
    expect(service).toBeTruthy();
    expect(service.currentLang()).toBe('en-GB');
  });

  it('should translate keys from base dictionary correctly', () => {
    const text = service.translate('app.title');
    expect(text).toBe('HelloTalk');
  });

  it('should interpolate parameters e.g. coins inside string', () => {
    const text = service.translate('common.coinsBalance', { coins: 150 });
    expect(text).toBe('150 Coins');
  });

  it('should update document dir to rtl when changing language to ar (Arabic)', async () => {
    await service.setLanguage('ar');
    expect(service.currentLang()).toBe('ar');
    if (typeof document !== 'undefined') {
      expect(document.documentElement.dir).toBe('rtl');
    }
  });

  it('should update document dir to ltr when changing language to es (Spanish)', async () => {
    await service.setLanguage('es');
    expect(service.currentLang()).toBe('es');
    if (typeof document !== 'undefined') {
      expect(document.documentElement.dir).toBe('ltr');
    }
  });

  it('should allow switching to ANY custom language code (e.g. sw Swahili)', async () => {
    await service.setLanguage('sw');
    expect(service.currentLang()).toBe('sw');
    expect(localStorage.getItem('hellotalk_locale')).toBe('sw');
  });
});
