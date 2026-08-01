import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
