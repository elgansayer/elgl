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

  it('should have safe default signal values', () => {
    expect(service.autoTranslate()).toBe(false);
    expect(service.readReceipts()).toBe(false);
    expect(service.enterToSend()).toBe(false);
    expect(service.textSize()).toBe('medium');
    expect(service.disappearingMessagesTtl()).toBe('off');
    expect(service.disappearingMessagesSaving()).toBe(false);
    expect(service.disappearingMessagesError()).toBe(false);
    expect(service.settingsLoadError()).toBe(false);
    expect(service.loaded()).toBe(false);
  });

  describe('loadSettings', () => {
    it('loads the authoritative disappearing-message setting', async () => {
      const promise = service.loadSettings();
      const req = httpTesting.expectOne('http://localhost:3000/api/chat/settings');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
        textSize: 'large',
        disappearingMessagesTtl: '7d',
      });

      await promise;

      expect(service.autoTranslate()).toBe(true);
      expect(service.readReceipts()).toBe(true);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('large');
      expect(service.disappearingMessagesTtl()).toBe('7d');
      expect(service.settingsLoadError()).toBe(false);
      expect(service.loaded()).toBe(true);
    });

    it('normalizes missing or unknown retention values to off', async () => {
      const missing = service.loadSettings();
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .flush({ autoTranslate: false, readReceipts: false, enterToSend: false });
      await missing;
      expect(service.disappearingMessagesTtl()).toBe('off');

      const unknown = service.loadSettings();
      httpTesting.expectOne('http://localhost:3000/api/chat/settings').flush({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
        disappearingMessagesTtl: '1m',
      });
      await unknown;
      expect(service.disappearingMessagesTtl()).toBe('off');
    });

    it('marks settings unavailable without pretending a previously loaded value is off', async () => {
      service.disappearingMessagesTtl.set('90d');
      const promise = service.loadSettings();
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      await promise;

      expect(service.disappearingMessagesTtl()).toBe('90d');
      expect(service.settingsLoadError()).toBe(true);
      expect(service.loaded()).toBe(true);
    });

    it('clears the unavailable state after a successful retry', async () => {
      const failed = service.loadSettings();
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .error(new ProgressEvent('error'));
      await failed;
      expect(service.settingsLoadError()).toBe(true);

      const retry = service.loadSettings();
      httpTesting.expectOne('http://localhost:3000/api/chat/settings').flush({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
        disappearingMessagesTtl: '24h',
      });
      await retry;

      expect(service.settingsLoadError()).toBe(false);
      expect(service.disappearingMessagesTtl()).toBe('24h');
    });
  });

  describe('updateSetting', () => {
    it('updates ordinary settings and reverts them on failure', async () => {
      const success = service.updateSetting('autoTranslate', true);
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .flush({ autoTranslate: true });
      await success;
      expect(service.autoTranslate()).toBe(true);

      const failure = service.updateSetting('autoTranslate', false);
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .error(new ProgressEvent('error'));
      await failure;
      expect(service.autoTranslate()).toBe(true);
    });
  });

  describe('updateDisappearingMessagesTtl', () => {
    it('persists a supported lifetime and clears pending state', async () => {
      const promise = service.updateDisappearingMessagesTtl('24h');
      expect(service.disappearingMessagesTtl()).toBe('24h');
      expect(service.disappearingMessagesSaving()).toBe(true);

      const req = httpTesting.expectOne('http://localhost:3000/api/chat/settings');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ disappearingMessagesTtl: '24h' });
      req.flush({ disappearingMessagesTtl: '24h' });

      await expect(promise).resolves.toBe(true);
      expect(service.disappearingMessagesSaving()).toBe(false);
      expect(service.disappearingMessagesError()).toBe(false);
    });

    it('rolls back the setting and exposes a retryable error on failure', async () => {
      service.disappearingMessagesTtl.set('7d');

      const promise = service.updateDisappearingMessagesTtl('90d');
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      await expect(promise).resolves.toBe(false);
      expect(service.disappearingMessagesTtl()).toBe('7d');
      expect(service.disappearingMessagesSaving()).toBe(false);
      expect(service.disappearingMessagesError()).toBe(true);
    });

    it('suppresses duplicate changes while a save is pending', async () => {
      const first = service.updateDisappearingMessagesTtl('24h');
      const second = service.updateDisappearingMessagesTtl('90d');

      await expect(second).resolves.toBe(false);
      expect(service.disappearingMessagesTtl()).toBe('24h');

      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .flush({ disappearingMessagesTtl: '24h' });
      await first;
    });

    it('does not change retention while authoritative settings are unavailable', async () => {
      service.settingsLoadError.set(true);
      service.disappearingMessagesTtl.set('7d');

      await expect(service.updateDisappearingMessagesTtl('off')).resolves.toBe(false);
      expect(service.disappearingMessagesTtl()).toBe('7d');
      httpTesting.expectNone('http://localhost:3000/api/chat/settings');
    });
  });

  describe('resetToDefaults', () => {
    it('persists off so reset cannot leave hidden disappearing retention active', async () => {
      service.autoTranslate.set(true);
      service.disappearingMessagesTtl.set('90d');

      const promise = service.resetToDefaults();
      const req = httpTesting.expectOne('http://localhost:3000/api/chat/settings');
      expect(req.request.body).toEqual({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
        disappearingMessagesTtl: 'off',
      });
      req.flush({});

      await expect(promise).resolves.toBe(true);
      expect(service.autoTranslate()).toBe(false);
      expect(service.disappearingMessagesTtl()).toBe('off');
    });

    it('restores previous values if reset persistence fails', async () => {
      service.autoTranslate.set(true);
      service.disappearingMessagesTtl.set('7d');

      const promise = service.resetToDefaults();
      httpTesting
        .expectOne('http://localhost:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      await expect(promise).resolves.toBe(false);
      expect(service.autoTranslate()).toBe(true);
      expect(service.disappearingMessagesTtl()).toBe('7d');
      expect(service.disappearingMessagesError()).toBe(true);
    });
  });
});
