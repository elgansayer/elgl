import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ChatSettingsService, ChatSettings } from './chat-settings.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let httpMock: HttpTestingController;

  const mockAuthService = {
    getBearerHeaders: vi.fn().mockReturnValue({
      Authorization: 'Bearer test-token',
    }),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatSettingsService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    service = TestBed.inject(ChatSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadSettings', () => {
    it('should load settings successfully from API', async () => {
      const mockSettings: ChatSettings = {
        autoTranslate: true,
        readReceipts: true,
        enterToSend: true,
        textSize: 'large',
      };

      const loadPromise = service.loadSettings();

      const req = httpMock.expectOne(`${environment.apiUrl}/chat/settings`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSettings);

      await loadPromise;

      expect(service.autoTranslate()).toBe(true);
      expect(service.readReceipts()).toBe(true);
      expect(service.enterToSend()).toBe(true);
      expect(service.textSize()).toBe('large');
      expect(service.loaded()).toBe(true);
    });

    it('should fallback to defaults on error', async () => {
      const loadPromise = service.loadSettings();

      const req = httpMock.expectOne(`${environment.apiUrl}/chat/settings`);
      expect(req.request.method).toBe('GET');
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });

      await loadPromise;

      expect(service.autoTranslate()).toBe(false);
      expect(service.readReceipts()).toBe(false);
      expect(service.enterToSend()).toBe(false);
      expect(service.textSize()).toBe('medium');
      expect(service.loaded()).toBe(true);
    });
  });

  describe('updateSetting', () => {
    it('should optimistically update and make API call', async () => {
      service.autoTranslate.set(false);

      const updatePromise = service.updateSetting('autoTranslate', true);

      expect(service.autoTranslate()).toBe(true); // Optimistic update

      const req = httpMock.expectOne(`${environment.apiUrl}/chat/settings`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ autoTranslate: true });
      req.flush({ autoTranslate: true });

      await updatePromise;

      expect(service.autoTranslate()).toBe(true);
    });

    it('should revert to previous value on API failure', async () => {
      service.autoTranslate.set(false);

      const updatePromise = service.updateSetting('autoTranslate', true);

      expect(service.autoTranslate()).toBe(true); // Optimistic update

      const req = httpMock.expectOne(`${environment.apiUrl}/chat/settings`);
      expect(req.request.method).toBe('PUT');
      req.flush('Error', { status: 500, statusText: 'Internal Server Error' });

      await updatePromise;

      expect(service.autoTranslate()).toBe(false); // Reverted
    });
  });
});
