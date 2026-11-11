import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { classifyDmcaFailure, DmcaNoticePayload, DmcaService } from './dmca.service';

const BASE = `${environment.apiUrl}/dmca/notices`;

const payload: DmcaNoticePayload = {
  claimantName: 'Ana Costa',
  claimantEmail: 'ana@example.com',
  copyrightedWork: 'The song "Mar" (2019)',
  materialReferences: ['0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'],
  goodFaithStatement: true,
  accuracyStatement: true,
  electronicSignature: 'Ana Costa',
};

const ownerNotice = {
  id: 'n1',
  reference: 'DMCA-ABCDEFGHJK',
  status: 'content_disabled',
  targetType: 'moment',
  claimantName: 'Ana Costa',
  claimantOrganisation: null,
  copyrightedWork: 'The song "Mar"',
  contentDisabledAt: '2026-11-11T10:00:00.000Z',
  counterNoticeAt: null,
  restoreAfter: null,
  closedAt: null,
  canCounterNotice: true,
  createdAt: '2026-11-11T09:00:00.000Z',
};

describe('DmcaService', () => {
  let service: DmcaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getBearerHeaders: () => new HttpHeaders({ Authorization: 'Bearer owner-token' }) },
        },
      ],
    });
    service = TestBed.inject(DmcaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('submits a notice without credentials, because claimants have no account', async () => {
    const result = service.submitNotice(payload);

    const request = httpMock.expectOne(BASE);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toEqual(payload);
    request.flush({ references: ['DMCA-AAAAAAAAAA', 7], status: 'pending_verification' });

    await expect(result).resolves.toEqual({ references: ['DMCA-AAAAAAAAAA'] });
  });

  it('rejects a submission response without references', async () => {
    const result = service.submitNotice(payload);
    httpMock.expectOne(BASE).flush({ status: 'ok' });
    await expect(result).rejects.toThrow('Invalid copyright notice response');
  });

  it('confirms a notice with the emailed token only', async () => {
    const result = service.verifyNotice('T'.repeat(43));

    const request = httpMock.expectOne(`${BASE}/verify`);
    expect(request.request.body).toEqual({ token: 'T'.repeat(43) });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ notices: [{ reference: 'DMCA-AAAAAAAAAA', status: 'content_disabled' }] });

    await expect(result).resolves.toEqual([
      { reference: 'DMCA-AAAAAAAAAA', status: 'content_disabled' },
    ]);
  });

  it('rejects a confirmation response with an unknown status', async () => {
    const result = service.verifyNotice('T'.repeat(43));
    httpMock.expectOne(`${BASE}/verify`).flush({ notices: [{ reference: 'X', status: 'deleted' }] });
    await expect(result).rejects.toThrow('Invalid copyright notice response');
  });

  it('lists the owner notices with their bearer token', async () => {
    const result = service.listMine();

    const request = httpMock.expectOne(`${BASE}/mine`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    request.flush([ownerNotice]);

    await expect(result).resolves.toEqual([
      {
        id: 'n1',
        reference: 'DMCA-ABCDEFGHJK',
        status: 'content_disabled',
        claimantName: 'Ana Costa',
        claimantOrganisation: null,
        copyrightedWork: 'The song "Mar"',
        contentDisabledAt: '2026-11-11T10:00:00.000Z',
        counterNoticeAt: null,
        restoreAfter: null,
        canCounterNotice: true,
      },
    ]);
  });

  it.each([
    { not: 'a list' },
    [{ ...ownerNotice, status: 'mystery' }],
    [{ ...ownerNotice, canCounterNotice: 'yes' }],
    [{ ...ownerNotice, reference: 5 }],
  ])('rejects the malformed owner list %j', async (body) => {
    const result = service.listMine();
    httpMock.expectOne(`${BASE}/mine`).flush(body);
    await expect(result).rejects.toThrow('Invalid copyright notice response');
  });

  it('files a counter-notification for the chosen notice only', async () => {
    const counter = {
      fullName: 'Sam Lee',
      address: '1 Road, Town',
      goodFaithStatement: true,
      jurisdictionConsent: true,
      electronicSignature: 'Sam Lee',
    };
    const result = service.fileCounterNotice('a/b', counter);

    const request = httpMock.expectOne(`${BASE}/a%2Fb/counter-notice`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer owner-token');
    expect(request.request.body).toEqual(counter);
    request.flush({ ...ownerNotice, status: 'counter_notice_received', canCounterNotice: false });

    await expect(result).resolves.toMatchObject({
      status: 'counter_notice_received',
      canCounterNotice: false,
    });
  });

  describe('classifyDmcaFailure', () => {
    it.each([
      [400, 'invalid'],
      [404, 'not_found'],
      [409, 'conflict'],
      [410, 'gone'],
      [429, 'rate_limited'],
      [500, 'unavailable'],
      [503, 'unavailable'],
      [0, 'unavailable'],
    ] as const)('maps HTTP %i to %s', (status, expected) => {
      expect(classifyDmcaFailure(new HttpErrorResponse({ status }))).toBe(expected);
    });

    it('treats anything that is not an HTTP error as unavailable', () => {
      expect(classifyDmcaFailure(new Error('x'))).toBe('unavailable');
    });
  });
});
