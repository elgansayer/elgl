import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AGE_GATE_ERROR_CODES, AgeGateService, readApiErrorCode } from './age-gate.service';
import { AuthService } from './auth.service';

describe('AgeGateService', () => {
  const baseUrl = `${environment.apiUrl}/age-gate`;
  let service: AgeGateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getBearerHeaders: () => new HttpHeaders({ Authorization: 'Bearer token-1' }),
          },
        },
      ],
    });
    service = TestBed.inject(AgeGateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the caller state with their bearer token and remembers it', async () => {
    const result = service.loadStatus();

    const request = httpMock.expectOne(`${baseUrl}/status`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({ status: 'required', required: true, blocked: false });

    await expect(result).resolves.toEqual({ status: 'required', required: true, blocked: false });
    expect(service.view()).toEqual({ status: 'required', required: true, blocked: false });
    expect(service.isRequired()).toBe(true);
    expect(service.isBlocked()).toBe(false);
  });

  it('sends only the date of birth when declaring it', async () => {
    const result = service.submit('1990-04-23');

    const request = httpMock.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ dateOfBirth: '1990-04-23' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({ status: 'blocked_under_age', required: false, blocked: true });

    await expect(result).resolves.toMatchObject({ blocked: true });
    expect(service.isBlocked()).toBe(true);
  });

  it.each([
    null,
    'blocked',
    { status: 'passed' },
    { status: 'verified', required: false, blocked: false },
    { status: 'passed', required: 'no', blocked: false },
  ])('rejects the malformed response %j', async (payload) => {
    const result = service.loadStatus();
    httpMock.expectOne(`${baseUrl}/status`).flush(payload);

    await expect(result).rejects.toThrow('Invalid age gate response');
    expect(service.view()).toBeNull();
  });

  it('keeps nothing when the request fails', async () => {
    const result = service.loadStatus();
    httpMock.expectOne(`${baseUrl}/status`).flush({}, { status: 503, statusText: 'Unavailable' });

    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(service.view()).toBeNull();
  });

  describe('recordRejection', () => {
    it('marks the account blocked or required from the server code', () => {
      service.recordRejection(AGE_GATE_ERROR_CODES.required);
      expect(service.view()).toEqual({ status: 'required', required: true, blocked: false });

      service.recordRejection(AGE_GATE_ERROR_CODES.blocked);
      expect(service.view()).toEqual({
        status: 'blocked_under_age',
        required: false,
        blocked: true,
      });
    });

    it('ignores codes it does not own', () => {
      service.recordRejection('SOMETHING_ELSE');
      expect(service.view()).toBeNull();
    });
  });

  describe('readApiErrorCode', () => {
    it('reads the machine-readable code from an API error body', () => {
      const error = new HttpErrorResponse({
        status: 403,
        error: { statusCode: 403, code: 'AGE_GATE_BLOCKED' },
      });
      expect(readApiErrorCode(error)).toBe('AGE_GATE_BLOCKED');
    });

    it.each([
      new HttpErrorResponse({ status: 403, error: 'plain text' }),
      new HttpErrorResponse({ status: 403, error: { code: 12 } }),
      new HttpErrorResponse({ status: 403, error: null }),
      new Error('x'),
      null,
    ])('returns null for %j', (error) => {
      expect(readApiErrorCode(error)).toBeNull();
    });
  });
});
