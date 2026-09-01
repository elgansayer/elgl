import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
import { AuthService } from './auth.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('I18nService', () => {
  let service: I18nService;
  let mockAuthService: Partial<AuthService>;

  beforeEach(() => {
    localStorage.clear();

    mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(I18nService);
  });

  describe('setLanguage', () => {
    it('should set the language and update document directionality', async () => {
      await service.setLanguage('ar');
      expect(service.currentLang()).toBe('ar');
      if (typeof document !== 'undefined') {
        expect(document.documentElement.lang).toBe('ar');
        expect(document.documentElement.dir).toBe('rtl');
      }
    });

    it('should cache the language in localStorage', async () => {
      await service.setLanguage('fr');
      expect(localStorage.getItem('hellotalk_locale')).toBe('fr');
    });

    it('should load translations from localStorage cache if available', async () => {
      const cachedTranslations = { 'test.key': 'Cached Translation' };
      localStorage.setItem('hellotalk_dict_fr', JSON.stringify(cachedTranslations));
      await service.setLanguage('fr');
      expect(service.translate('test.key')).toBe('Cached Translation');
    });

    it('should fallback to base dictionary if translation key is missing', async () => {
      await service.setLanguage('fr');
      expect(service.translate('app.title')).toBe('HelloTalk');
    });

    it('should not change the language when given an empty or whitespace-only string', async () => {
      const initial = service.currentLang();
      await service.setLanguage('   ');
      expect(service.currentLang()).toBe(initial);
    });

    it('should trim surrounding whitespace from the language code', async () => {
      await service.setLanguage('  fr  ');
      expect(service.currentLang()).toBe('fr');
    });

    it('should retain base dictionary translations for keys missing from a partial cached dictionary', async () => {
      const partialCache = { 'test.key': 'Only this key cached' };
      localStorage.setItem('hellotalk_dict_de', JSON.stringify(partialCache));
      await service.setLanguage('de');
      expect(service.translate('test.key')).toBe('Only this key cached');
      expect(service.translate('app.title')).toBe('HelloTalk');
    });

    it('should initialise the language from a previously saved localStorage value on construction', () => {
      localStorage.setItem('hellotalk_locale', 'de');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      const freshService = TestBed.inject(I18nService);
      expect(freshService.currentLang()).toBe('de');
    });

    it('should call the backend API for translations if not cached', async () => {
      vi.spyOn(window, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ translations: { 'test.key': 'API Translation' } }),
      } as Response);
      await service.setLanguage('de');
      expect(service.translate('test.key')).toBe('API Translation');
    });

    it('should handle API errors gracefully and fallback to base dictionary', async () => {
      vi.spyOn(window, 'fetch').mockRejectedValue(new Error('API Error'));
      await service.setLanguage('de');
      expect(service.translate('app.title')).toBe('HelloTalk');
    });
  });

  describe('translate', () => {
    it('should return the translation for a given key', () => {
      const translation = service.translate('app.title');
      expect(translation).toBe('HelloTalk');
    });

    it('should interpolate parameters in the translation string', () => {
      const translation = service.translate('common.coinsBalance', { coins: 100 });
      expect(translation).toBe('100 Coins');
    });

    it('should return the key itself if no translation is found', () => {
      const translation = service.translate('non.existent.key');
      expect(translation).toBe('non.existent.key');
    });

    it('should interpolate multiple parameters in a single translation string', () => {
      const translation = service.translate('gift.broadcastDesc', {
        sender: 'Alice',
        receiver: 'Bob',
        giftName: 'Rose',
        cost: 50,
      });
      expect(translation).toBe('🎉 Alice gifted Bob a Rose! (🪙 50 Coins)');
    });

    it('should ignore params that do not appear as placeholders in the translation string', () => {
      const translation = service.translate('app.title', { unused: 'value' });
      expect(translation).toBe('HelloTalk');
    });
  });

  describe('availableLanguages', () => {
    it('should mark ar, fa, he, and ur as RTL languages and no others', () => {
      const rtlCodes = service.availableLanguages
        .filter((lang) => lang.isRtl)
        .map((lang) => lang.code)
        .sort();
      expect(rtlCodes).toEqual(['ar', 'fa', 'he', 'ur']);
    });

    it('should include British English as a non-RTL entry', () => {
      const enGB = service.availableLanguages.find((lang) => lang.code === 'en-GB');
      expect(enGB).toBeTruthy();
      expect(enGB?.isRtl).toBe(false);
    });

    it('should have unique language codes', () => {
      const codes = service.availableLanguages.map((lang) => lang.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe('Gender filter dropdown translations', () => {
    it('should expose the gender filter label and options', () => {
      expect(service.translate('discovery.genderLabel')).toBe('Gender');
      expect(service.translate('discovery.genderAny')).toBe('Any gender');
      expect(service.translate('discovery.genderMale')).toBe('Male');
      expect(service.translate('discovery.genderFemale')).toBe('Female');
    });

    it('should expose the VIP-required message for gender filtering', () => {
      expect(service.translate('discovery.genderVipRequired')).toBe(
        'VIP required to filter by gender',
      );
    });
  });

  it('should be created with default British English language', () => {
    expect(service).toBeTruthy();
    expect(service.currentLang()).toBe('en-GB');
  });

  it('should translate keys from base dictionary correctly', () => {
    const text = service.translate('app.title');
    expect(text).toBe('HelloTalk');
  });

  it('should translate the audio intro feed empty state from the base dictionary', () => {
    expect(service.translate('discovery.audioIntroFeed.title')).toBe('Audio introductions');
    expect(
      service.translate('discovery.audioIntroFeed.languagePair', {
        native: 'Japanese',
        target: 'English',
      }),
    ).toBe('Japanese → English');
    expect(service.translate('discovery.audioIntroFeed.noAudioIntros')).toBe(
      'No audio introductions available.',
    );
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

  it('should set dir to rtl for all RTL languages (ar, he, fa, ur)', async () => {
    for (const lang of ['ar', 'he', 'fa', 'ur']) {
      await service.setLanguage(lang);
      expect(service.currentLang()).toBe(lang);
      if (typeof document !== 'undefined') {
        expect(document.documentElement.dir).toBe('rtl');
      }
    }
  });

  it('should reuse cached translation dictionary from localStorage when available', async () => {
    const cached = { 'vip.heroTitle': 'Cached VIP Hero' };
    localStorage.setItem('hellotalk_dict_fr', JSON.stringify(cached));
    await service.setLanguage('fr');
    expect(service.translate('vip.heroTitle')).toBe('Cached VIP Hero');
  });

  describe('VIP subscription showcase translations', () => {
    it('should have hero and CTA translations', () => {
      expect(service.translate('vip.heroTitle')).toBe('Unlock Your Language Learning Potential');
      expect(service.translate('vip.heroSubtitle')).toBe(
        'Choose the plan that fits your learning journey. From free basics to premium power tools.',
      );
      expect(service.translate('vip.seePlans')).toBe('See Plans');
      expect(service.translate('vip.startFree')).toBe('Start Free');
    });

    it('should contain price labels with both currencies', () => {
      expect(service.translate('vip.freePrice')).toBe('Free');
      expect(service.translate('vip.consumerPrice')).toBe('8 UKP / $10 USD');
      expect(service.translate('vip.developerPrice')).toBe('20 UKP / $26 USD');
      expect(service.translate('vip.billedMonthly')).toBe('billed monthly');
    });

    it('should expose VIP badge labels', () => {
      expect(service.translate('common.vipStdLabel')).toBe('8 UKP / $10 USD VIP');
      expect(service.translate('common.vipDevLabel')).toBe('20 UKP / $26 USD Dev VIP');
    });

    it('should include feature list descriptions', () => {
      expect(service.translate('vip.consumerFeature1')).toBe('Unlimited AI calls');
      expect(service.translate('vip.consumerFeature2')).toBe('Global discovery');
      expect(service.translate('vip.developerFeature3')).toBe('600 RPM rate limit');
      expect(service.translate('vip.developerFeature4')).toBe('Advanced analytics');
    });

    it('should include FAQ translations', () => {
      expect(service.translate('vip.faqTitle')).toBe('Frequently Asked Questions');
      expect(service.translate('vip.faqSwitchQ')).toBe('Can I switch plans anytime?');
      expect(service.translate('vip.faqPaymentA')).toBe(
        'We accept all major credit cards, PayPal, and in-app purchases on iOS and Android.',
      );
      expect(service.translate('vip.faqCancelQ')).toBe('Can I cancel my subscription?');
    });

    it('should interpolate plan name inside choosePlan key', () => {
      const text = service.translate('vip.choosePlan', { name: 'Consumer VIP' });
      expect(text).toBe('Choose Consumer VIP');
    });

    it('should contain all VIP showcase keys with non-empty values', () => {
      const vipKeys = [
        'vip.heroTitle',
        'vip.heroSubtitle',
        'vip.seePlans',
        'vip.startFree',
        'vip.tryAgain',
        'vip.failedLoad',
        'vip.freeUpgrade',
        'vip.getStartedFree',
        'vip.freePrice',
        'vip.premiumPlans',
        'vip.premiumSubtitle',
        'vip.mostPopular',
        'vip.billedMonthly',
        'vip.keyBenefits',
        'vip.allFeatures',
        'vip.subscribeNow',
        'vip.choosePlan',
        'vip.compareAllFeatures',
        'vip.featureTableHeader',
        'vip.included',
        'vip.notIncluded',
        'vip.ctaTitle',
        'vip.ctaSubtitle',
        'vip.viewPlans',
        'vip.continueFree',
        'vip.freePlan',
        'vip.freeFeature1',
        'vip.freeFeature2',
        'vip.freeFeature3',
        'vip.consumerPlan',
        'vip.consumerPrice',
        'vip.consumerFeature1',
        'vip.consumerFeature2',
        'vip.consumerFeature3',
        'vip.consumerFeature4',
        'vip.developerPlan',
        'vip.developerPrice',
        'vip.developerFeature1',
        'vip.developerFeature2',
        'vip.developerFeature3',
        'vip.developerFeature4',
        'vip.developerFeature5',
      ];

      for (const key of vipKeys) {
        const value = service.translate(key);
        expect(value).not.toBe(key);
        expect(value.trim()).not.toBe('');
      }
    });

    it('should return the key itself for unknown translation keys', () => {
      const key = 'vip.doesNotExist';
      expect(service.translate(key)).toBe(key);
    });
  });
});
