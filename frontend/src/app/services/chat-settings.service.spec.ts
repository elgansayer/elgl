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

  it('starts with safe defaults and no authoritative load', () => {
    expect(service.autoTranslate()).toBe(false);
    expect(service.readReceipts()).toBe(false);
    expect(service.enterToSend()).toBe(false);
    expect(service.textSize()).toBe('medium');
    expect(service.loaded()).toBe(false);
    expect(service.loadFailed()).toBe(false);
    expect(service.saving()).toBe(false);
  });

  describe('loadSettings', () => {
    it('loads authenticated settings and normalizes text size', async () => {
      const promise = service.loadSettings();
      expect(service.loaded()).toBe(false);
      expect(service.loadFailed()).toBe(false);

      const req = httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ autoTranslate: true, readReceipts: true, enterToSend: false, textSize: 'large' });

      expect(await promise).toBe(true);
      expect(service.autoTranslate()).toBe(true);
      expect(service.readReceipts()).toBe(true);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('large');
      expect(service.loaded()).toBe(true);
      expect(service.loadFailed()).toBe(false);
    });

    it('uses boolean-safe defaults for missing values', async () => {
      const promise = service.loadSettings();
      httpTesting
        .expectOne('http://127.0.0.1:3000/api/chat/settings')
        .flush({ autoTranslate: 'yes', readReceipts: 1, textSize: 'huge' });

      expect(await promise).toBe(true);
      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('medium');
    });

    it('marks malformed responses unavailable instead of presenting defaults as saved state', async () => {
      const promise = service.loadSettings();
      httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings').flush(null);

      expect(await promise).toBe(false);
      expect(service.loaded()).toBe(true);
      expect(service.loadFailed()).toBe(true);
    });

    it('marks transport failures unavailable and keeps safe in-memory defaults', async () => {
      const promise = service.loadSettings();
      httpTesting
        .expectOne('http://127.0.0.1:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      expect(await promise).toBe(false);
      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(false);
      expect(service.loaded()).toBe(true);
      expect(service.loadFailed()).toBe(true);
    });
  });

  describe('updateSetting', () => {
    it('applies a setting only after the authenticated API confirms persistence', async () => {
      const promise = service.updateSetting('autoTranslate', true);
      expect(service.saving()).toBe(true);
      expect(service.autoTranslate()).toBe(false);

      const req = httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ autoTranslate: true });
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      req.flush({ autoTranslate: true });

      expect(await promise).toBe(true);
      expect(service.autoTranslate()).toBe(true);
      expect(service.saving()).toBe(false);
    });

    it('rejects overlapping mutations before they can overwrite confirmed state', async () => {
      const first = service.updateSetting('readReceipts', true);
      const second = await service.updateSetting('enterToSend', true);

      expect(second).toBe(false);
      expect(service.enterToSend()).toBe(false);
      const req = httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings');
      expect(req.request.body).toEqual({ readReceipts: true });
      req.flush({ readReceipts: true });

      expect(await first).toBe(true);
      expect(service.readReceipts()).toBe(true);
    });

    it('retains the previously confirmed setting when persistence fails', async () => {
      service.autoTranslate.set(true);

      const promise = service.updateSetting('autoTranslate', false);
      httpTesting
        .expectOne('http://127.0.0.1:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      expect(await promise).toBe(false);
      expect(service.autoTranslate()).toBe(true);
      expect(service.saving()).toBe(false);
    });

    it('rejects invalid value types without issuing a request', async () => {
      const saved = await service.updateSetting('readReceipts', 'large');

      expect(saved).toBe(false);
      expect(service.readReceipts()).toBe(false);
      httpTesting.expectNone('http://127.0.0.1:3000/api/chat/settings');
    });

    it('still supports the existing chat text-size preference contract', async () => {
      const promise = service.updateSetting('textSize', 'small');
      httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings').flush({ textSize: 'small' });

      expect(await promise).toBe(true);
      expect(service.textSize()).toBe('small');
    });
  });

  describe('resetToDefaults', () => {
    it('persists all three message-behavior defaults atomically while preserving text size', async () => {
      service.autoTranslate.set(true);
      service.readReceipts.set(true);
      service.enterToSend.set(true);
      service.textSize.set('large');

      const promise = service.resetToDefaults();
      const req = httpTesting.expectOne('http://127.0.0.1:3000/api/chat/settings');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
      });
      req.flush({ autoTranslate: false, readReceipts: false, enterToSend: false });

      expect(await promise).toBe(true);
      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('large');
    });

    it('does not clear confirmed settings when reset persistence fails', async () => {
      service.autoTranslate.set(true);
      service.readReceipts.set(true);

      const promise = service.resetToDefaults();
      httpTesting
        .expectOne('http://127.0.0.1:3000/api/chat/settings')
        .error(new ProgressEvent('error'));

      expect(await promise).toBe(false);
      expect(service.autoTranslate()).toBe(true);
      expect(service.readReceipts()).toBe(true);
      expect(service.saving()).toBe(false);
    });
  });
});
