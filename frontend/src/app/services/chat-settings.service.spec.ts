import { environment } from '../../environments/environment';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ChatSettingsService } from './chat-settings.service';
import { AuthService } from './auth.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let httpTesting: HttpTestingController;
  const mockBearerHeaders = { Authorization: 'Bearer test-token' };

  beforeEach(() => {
    const authMock = {
      getBearerHeaders: vi.fn().mockReturnValue(mockBearerHeaders),
    };

    TestBed.configureTestingModule({
      providers: [
        ChatSettingsService,
        { provide: AuthService, useValue: authMock },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ChatSettingsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default signal values', () => {
    expect(service.autoTranslate()).toBe(false);
    expect(service.readReceipts()).toBe(false);
    expect(service.enterToSend()).toBe(false);
    expect(service.textSize()).toBe('medium');
    expect(service.loaded()).toBe(false);
  });

  describe('loadSettings', () => {
    it('should load settings from the API and update signals', async () => {
      const mockSettings = {
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
        textSize: 'large',
      };

      const promise = service.loadSettings();
      const req = httpTesting.expectOne(`${environment.apiUrl}/chat/settings`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush(mockSettings);

      await promise;

      expect(service.autoTranslate()).toBe(true);
      expect(service.readReceipts()).toBe(true);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('large');
      expect(service.loaded()).toBe(true);
    });

    it('should fall back to defaults when textSize is missing', async () => {
      const promise = service.loadSettings();
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .flush({ autoTranslate: false, readReceipts: false, enterToSend: false });

      await promise;
      expect(service.textSize()).toBe('medium');
      expect(service.loaded()).toBe(true);
    });

    it('should fall back to defaults on API error', async () => {
      const promise = service.loadSettings();
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .error(new ProgressEvent('error'));

      await promise;

      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('medium');
      expect(service.loaded()).toBe(true);
    });
  });

  describe('updateSetting', () => {
    it('should update autoTranslate and call the API', async () => {
      const promise = service.updateSetting('autoTranslate', true);
      httpTesting.expectOne(`${environment.apiUrl}/chat/settings`).flush({ autoTranslate: true });

      await promise;
      expect(service.autoTranslate()).toBe(true);
    });

    it('should update readReceipts and call the API', async () => {
      const promise = service.updateSetting('readReceipts', true);
      httpTesting.expectOne(`${environment.apiUrl}/chat/settings`).flush({ readReceipts: true });

      await promise;
      expect(service.readReceipts()).toBe(true);
    });

    it('should update enterToSend and call the API', async () => {
      const promise = service.updateSetting('enterToSend', true);
      httpTesting.expectOne(`${environment.apiUrl}/chat/settings`).flush({ enterToSend: true });

      await promise;
      expect(service.enterToSend()).toBe(true);
    });

    it('should update textSize and call the API', async () => {
      const promise = service.updateSetting('textSize', 'small');
      httpTesting.expectOne(`${environment.apiUrl}/chat/settings`).flush({ textSize: 'small' });

      await promise;
      expect(service.textSize()).toBe('small');
    });

    it('should revert to previous value on API failure', async () => {
      service.autoTranslate.set(false);

      const promise = service.updateSetting('autoTranslate', true);
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .error(new ProgressEvent('error'));

      await promise;
      expect(service.autoTranslate()).toBe(false);
    });

    it('should revert textSize to previous value on API failure', async () => {
      service.textSize.set('medium');

      const promise = service.updateSetting('textSize', 'large');
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .error(new ProgressEvent('error'));

      await promise;
      expect(service.textSize()).toBe('medium');
    });

    it('surfaces a failed save instead of reverting silently', async () => {
      const promise = service.updateSetting('readReceipts', true);
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .error(new ProgressEvent('error'));

      expect(await promise).toBe(false);
      expect(service.settingSaveError()).toBe(true);
      expect(service.settingSaving()).toBe(false);
    });

    it('rejects an overlapping save while another is in flight', async () => {
      const first = service.updateSetting('autoTranslate', true);
      expect(await service.updateSetting('enterToSend', true)).toBe(false);

      const requests = httpTesting.match(`${environment.apiUrl}/chat/settings`);
      expect(requests).toHaveLength(1);
      requests[0].flush({});
      expect(await first).toBe(true);
      expect(service.enterToSend()).toBe(false);
    });

    it('rejects invalid values without calling the API', async () => {
      expect(await service.updateSetting('textSize', 'huge' as unknown as 'small')).toBe(false);
      expect(await service.updateSetting('autoTranslate', 'yes' as unknown as boolean)).toBe(false);
      httpTesting.expectNone(`${environment.apiUrl}/chat/settings`);
    });

    it('does not edit settings while the authoritative state is unreadable', async () => {
      service.settingsLoadError.set(true);
      expect(await service.updateSetting('autoTranslate', true)).toBe(false);
      httpTesting.expectNone(`${environment.apiUrl}/chat/settings`);
    });
  });

  describe('loadSettings response validation', () => {
    it('treats a malformed payload as unreadable rather than authoritative', async () => {
      const promise = service.loadSettings();
      httpTesting.expectOne(`${environment.apiUrl}/chat/settings`).flush([true]);

      expect(await promise).toBe(false);
      expect(service.settingsLoadError()).toBe(true);
    });

    it('only accepts explicit booleans for toggles', async () => {
      const promise = service.loadSettings();
      httpTesting
        .expectOne(`${environment.apiUrl}/chat/settings`)
        .flush({ autoTranslate: 'true', readReceipts: 1, enterToSend: true });

      expect(await promise).toBe(true);
      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(true);
    });
  });
});
