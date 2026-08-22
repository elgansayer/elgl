import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ProfileVisibilityService } from './profile-visibility.service';

describe('ProfileVisibilityService', () => {
  let service: ProfileVisibilityService;
  let httpTesting: HttpTestingController;
  const getAccessToken = vi.fn();

  beforeEach(() => {
    getAccessToken.mockReset().mockReturnValue('test-token');

    TestBed.configureTestingModule({
      providers: [
        ProfileVisibilityService,
        { provide: AuthService, useValue: { getAccessToken } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProfileVisibilityService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the persisted visibility with bearer authentication', async () => {
    const promise = service.get();
    const request = httpTesting.expectOne('http://localhost:3000/api/users/me/privacy-settings');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ profile_visibility: 'vips_only' });

    await expect(promise).resolves.toBe('vips_only');
  });

  it('rejects malformed visibility responses instead of defaulting to everyone', async () => {
    const promise = service.get();
    httpTesting
      .expectOne('http://localhost:3000/api/users/me/privacy-settings')
      .flush({ profile_visibility: 'public-ish' });

    await expect(promise).rejects.toThrow('Profile visibility response is invalid');
  });

  it('persists the requested visibility and verifies the read-back response', async () => {
    const promise = service.set('hidden');
    const request = httpTesting.expectOne('http://localhost:3000/api/users/me/privacy');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ profile_visibility: 'hidden' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({ profile_visibility: 'hidden' });

    await expect(promise).resolves.toBe('hidden');
  });

  it('rejects a successful HTTP response when the server did not persist the requested value', async () => {
    const promise = service.set('hidden');
    httpTesting
      .expectOne('http://localhost:3000/api/users/me/privacy')
      .flush({ profile_visibility: 'everyone' });

    await expect(promise).rejects.toThrow('Profile visibility update was not persisted');
  });

  it('propagates HTTP failures instead of returning mock privacy state', async () => {
    const promise = service.set('vips_only');
    httpTesting
      .expectOne('http://localhost:3000/api/users/me/privacy')
      .error(new ProgressEvent('error'));

    await expect(promise).rejects.toBeTruthy();
  });

  it('fails before making a request when no authenticated session exists', async () => {
    getAccessToken.mockReturnValue(null);

    await expect(service.get()).rejects.toThrow('Authentication required');
    httpTesting.expectNone('http://localhost:3000/api/users/me/privacy-settings');
  });
});
