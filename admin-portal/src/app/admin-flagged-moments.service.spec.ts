import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLoginService } from './admin-login.service';
import {
  AdminFlaggedMomentsService,
  ModerationActionError,
} from './admin-flagged-moments.service';

const apiItem = {
  reportId: 'report-1',
  status: 'pending',
  reasonCategory: 'harassment',
  reportDescription: 'rude',
  createdAt: '2026-11-09T10:00:00.000Z',
  reporter: { id: 'reporter-1', displayName: 'Reporter' },
  author: {
    id: 'author-1',
    displayName: 'Author',
    activeSuspension: { id: 'susp-1', expiresAt: '2026-11-20T00:00:00.000Z' },
  },
  moment: {
    id: 'moment-1',
    excerpt: 'flagged words',
    available: true,
    postType: 'moment',
    targetLanguage: 'es',
    mediaType: 'image',
    mediaUrls: ['https://cdn.example.test/a.png'],
  },
};

describe('AdminFlaggedMomentsService', () => {
  const httpGet = vi.fn();
  const httpPost = vi.fn();
  let token: string | null;
  let service: AdminFlaggedMomentsService;

  beforeEach(() => {
    token = 'admin-token';
    httpGet.mockReset();
    httpPost.mockReset();
    TestBed.configureTestingModule({
      providers: [
        AdminFlaggedMomentsService,
        { provide: HttpClient, useValue: { get: httpGet, post: httpPost } },
        {
          provide: AdminLoginService,
          useValue: {
            accessToken: vi.fn(() => token),
            apiBaseUrl: vi.fn(async () => 'https://api.example.test'),
          },
        },
      ],
    });
    service = TestBed.inject(AdminFlaggedMomentsService);
  });

  const failureOf = async (call: () => Promise<unknown>) =>
    call().then(
      () => 'resolved',
      (error: unknown) => (error instanceof ModerationActionError ? error.failure : 'other'),
    );

  describe('list', () => {
    it('requests a bounded page with bearer auth and returns validated items', async () => {
      httpGet.mockReturnValue(of({ items: [apiItem], total: 11, page: 2, pageSize: 10 }));

      const result = await firstValueFrom(
        service.list({ page: 2, pageSize: 10, status: 'pending' }),
      );

      const [url, options] = httpGet.mock.calls[0] as [
        string,
        { headers: HttpHeaders; params: HttpParams },
      ];
      expect(url).toBe('https://api.example.test/admin/v1/moderation/flagged-moments');
      expect(options.headers.get('Authorization')).toBe('Bearer admin-token');
      expect(options.params.toString()).toBe('page=2&pageSize=10&status=pending');
      expect(result.total).toBe(11);
      expect(result.items[0].author.activeSuspension).toEqual({
        id: 'susp-1',
        expiresAt: '2026-11-20T00:00:00.000Z',
      });
    });

    it('refuses without a session and makes no request', async () => {
      token = null;

      await expect(
        failureOf(() => firstValueFrom(service.list({ page: 1, pageSize: 10, status: 'pending' }))),
      ).resolves.toBe('unauthenticated');
      expect(httpGet).not.toHaveBeenCalled();
    });

    it.each([
      ['a non-object body', 'oops'],
      ['a missing items array', { total: 0, page: 1, pageSize: 10 }],
      ['non-integer paging', { items: [], total: '1', page: 1, pageSize: 10 }],
      ['an unknown status', { items: [{ ...apiItem, status: 'escalated' }], total: 1, page: 1, pageSize: 10 }],
      [
        'an item without an author',
        { items: [{ ...apiItem, author: null }], total: 1, page: 1, pageSize: 10 },
      ],
      [
        'more than four media links',
        {
          items: [
            { ...apiItem, moment: { ...apiItem.moment, mediaUrls: Array(5).fill('https://x.test/a') } },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      ],
    ])('treats %s as unavailable instead of rendering partial data', async (_label, body) => {
      httpGet.mockReturnValue(of(body));

      await expect(
        failureOf(() => firstValueFrom(service.list({ page: 1, pageSize: 10, status: 'pending' }))),
      ).resolves.toBe('unavailable');
    });
  });

  describe('failure classification', () => {
    it.each([
      [401, undefined, 'unauthenticated'],
      [403, { code: 'ADMIN_TARGET_PROTECTED' }, 'target-protected'],
      [403, { message: 'Required admin capability missing' }, 'forbidden'],
      [404, undefined, 'not-found'],
      [409, undefined, 'conflict'],
      [400, undefined, 'invalid'],
      [422, undefined, 'invalid'],
      [429, undefined, 'rate-limited'],
      [500, undefined, 'unavailable'],
      [0, undefined, 'unavailable'],
    ])('maps HTTP %i %j to %s', async (status, body, expected) => {
      httpPost.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status, error: body, url: 'https://secret.example/db' })),
      );

      await expect(
        failureOf(() =>
          firstValueFrom(service.resolve('report-1', { decision: 'dismiss', reasonCode: 'other_reviewed' })),
        ),
      ).resolves.toBe(expected);
    });

    it('never surfaces transport detail or the bearer token in the error', async () => {
      httpPost.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 500, error: 'pg: password=hunter2', url: 'https://db.internal' }),
        ),
      );

      const error = await firstValueFrom(
        service.resolve('report-1', { decision: 'dismiss', reasonCode: 'other_reviewed' }),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ModerationActionError);
      expect(JSON.stringify(error)).not.toContain('hunter2');
      expect((error as Error).message).not.toContain('admin-token');
    });
  });

  describe('mutations', () => {
    it('posts a decision to the encoded report path', async () => {
      httpPost.mockReturnValue(of({ reportId: 'a/b', status: 'approved', replayed: false }));

      const result = await firstValueFrom(
        service.resolve('a/b', {
          decision: 'dismiss',
          reasonCode: 'other_reviewed',
          operatorNote: 'ok',
        }),
      );

      const [url, body, options] = httpPost.mock.calls[0] as [
        string,
        unknown,
        { headers: HttpHeaders },
      ];
      expect(url).toBe('https://api.example.test/admin/v1/moderation/flagged-moments/a%2Fb/resolve');
      expect(body).toEqual({ decision: 'dismiss', reasonCode: 'other_reviewed', operatorNote: 'ok' });
      expect(options.headers.get('Authorization')).toBe('Bearer admin-token');
      expect(result).toEqual({ reportId: 'a/b', status: 'approved', replayed: false });
    });

    it('suspends a user and reduces the response to the outcome the UI needs', async () => {
      httpPost.mockReturnValue(
        of({
          suspension: { id: 'susp-1', expiresAt: '2026-11-16T10:00:00.000Z', operatorNote: 'x' },
          replayed: true,
          reportStatus: 'rejected',
        }),
      );
      const input = {
        expiresAt: '2026-11-16T10:00:00.000Z',
        reasonCode: 'policy_violation' as const,
        reportId: 'report-1',
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      };

      const result = await firstValueFrom(service.suspend('user-1', input));

      expect(httpPost.mock.calls[0][0]).toBe(
        'https://api.example.test/admin/v1/moderation/users/user-1/suspensions',
      );
      expect(httpPost.mock.calls[0][1]).toEqual(input);
      expect(result).toEqual({
        suspensionId: 'susp-1',
        expiresAt: '2026-11-16T10:00:00.000Z',
        replayed: true,
      });
    });

    it('lifts a suspension', async () => {
      httpPost.mockReturnValue(
        of({ suspension: { id: 'susp-1', expiresAt: '2026-11-16T10:00:00.000Z' }, replayed: false }),
      );

      const result = await firstValueFrom(
        service.lift('susp-1', { reasonCode: 'support_correction' }),
      );

      expect(httpPost.mock.calls[0][0]).toBe(
        'https://api.example.test/admin/v1/moderation/suspensions/susp-1/lift',
      );
      expect(result).toEqual({ suspensionId: 'susp-1', replayed: false });
    });

    it.each<[string, () => Observable<unknown>]>([
      ['resolve', () => service.resolve('r', { decision: 'dismiss', reasonCode: 'other_reviewed' })],
      ['lift', () => service.lift('s', { reasonCode: 'support_correction' })],
    ])('rejects a malformed %s response as unavailable', async (_name, call) => {
      httpPost.mockReturnValue(of({ unexpected: true }));

      await expect(failureOf(() => firstValueFrom(call()))).resolves.toBe('unavailable');
    });

    it('sends no mutation without a session', async () => {
      token = null;

      await expect(
        failureOf(() =>
          firstValueFrom(service.lift('susp-1', { reasonCode: 'support_correction' })),
        ),
      ).resolves.toBe('unauthenticated');
      expect(httpPost).not.toHaveBeenCalled();
    });
  });
});
