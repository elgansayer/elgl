import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MessageFilterService } from './message-filter.service';

describe('MessageFilterService', () => {
  let service: MessageFilterService;
  let http: HttpTestingController;
  const token = 'test-token';
  const url = `${environment.apiUrl}/users/me/message-filters`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageFilterService,
        { provide: AuthService, useValue: { getAccessToken: () => token } },
      ],
    });

    service = TestBed.inject(MessageFilterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads the authenticated message-filter contract', async () => {
    const promise = service.load();
    const request = http.expectOne(url);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);

    request.flush({
      age_min: 21,
      age_max: 40,
      allowed_native_languages: ['ja'],
      allowed_genders: ['female'],
    });

    await expect(promise).resolves.toEqual({
      age_min: 21,
      age_max: 40,
      allowed_native_languages: ['ja'],
      allowed_genders: ['female'],
    });
  });

  it('saves filters through the authenticated endpoint without fabricating success', async () => {
    const filters = {
      age_min: 25,
      allowed_native_languages: ['ja', 'ko'],
    };
    const promise = service.save(filters);
    const request = http.expectOne(url);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(filters);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);

    request.flush(null);
    await expect(promise).resolves.toBeUndefined();
  });

  it('propagates load failures so the settings page cannot mistake an outage for empty filters', async () => {
    const promise = service.load();
    const request = http.expectOne(url);
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Unavailable' });

    await expect(promise).rejects.toBeTruthy();
  });

  it('propagates save failures so the page cannot report a false successful update', async () => {
    const promise = service.save({ age_min: 18 });
    const request = http.expectOne(url);
    request.flush({ message: 'failed' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeTruthy();
  });
});
