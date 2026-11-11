import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';
import { AdminLoginService } from './admin-login.service';

export const FLAGGED_MOMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type FlaggedMomentStatus = (typeof FLAGGED_MOMENT_STATUSES)[number];
export type FlaggedMomentDecision = 'dismiss' | 'uphold';

/** Reason codes the admin API accepts, with operator-facing labels. */
export const MODERATION_REASONS = [
  { code: 'policy_violation', label: 'Policy violation' },
  { code: 'fraud_or_abuse', label: 'Fraud or abuse' },
  { code: 'moderation_enforcement', label: 'Moderation enforcement' },
  { code: 'account_security', label: 'Account security' },
  { code: 'incident_response', label: 'Incident response' },
  { code: 'legal_request', label: 'Legal request' },
  { code: 'user_request', label: 'User request' },
  { code: 'support_correction', label: 'Support correction' },
  { code: 'other_reviewed', label: 'Other (reviewed)' },
] as const;
export type ModerationReasonCode = (typeof MODERATION_REASONS)[number]['code'];

export interface ActiveSuspension {
  id: string;
  expiresAt: string;
}

export interface FlaggedMomentItem {
  reportId: string;
  status: FlaggedMomentStatus;
  reasonCategory: string;
  reportDescription: string | null;
  createdAt: string;
  reporter: { id: string | null; displayName: string | null };
  author: { id: string; displayName: string | null; activeSuspension: ActiveSuspension | null };
  moment: {
    id: string;
    excerpt: string | null;
    available: boolean;
    postType: string | null;
    targetLanguage: string | null;
    mediaType: string | null;
    mediaUrls: string[];
  };
}

export interface FlaggedMomentList {
  items: FlaggedMomentItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResolveResult {
  reportId: string;
  status: FlaggedMomentStatus;
  replayed: boolean;
}

export interface SuspensionResult {
  suspensionId: string;
  expiresAt: string;
  replayed: boolean;
}

export interface LiftResult {
  suspensionId: string;
  replayed: boolean;
}

/** Why a moderation call failed, reduced to states an operator can act on. */
export type ModerationFailure =
  | 'unauthenticated'
  | 'forbidden'
  | 'target-protected'
  | 'not-found'
  | 'conflict'
  | 'invalid'
  | 'rate-limited'
  | 'unavailable';

const FAILURE_MESSAGES: Record<ModerationFailure, string> = {
  unauthenticated: 'Admin authentication required',
  forbidden: 'You do not have permission for this moderation action',
  'target-protected': 'Administrator accounts cannot be suspended from the moderation queue',
  'not-found': 'This item no longer exists',
  conflict: 'Another reviewer already decided this case. Reload the queue to see the outcome.',
  invalid: 'The request was rejected. Check the form and try again.',
  'rate-limited': 'Too many moderation actions. Wait a minute and try again.',
  unavailable: 'The moderation service is unavailable. Try again shortly.',
};

export class ModerationActionError extends Error {
  readonly failure: ModerationFailure;

  constructor(failure: ModerationFailure) {
    super(FAILURE_MESSAGES[failure]);
    this.name = 'ModerationActionError';
    this.failure = failure;
  }
}

const ADMIN_TARGET_PROTECTED = 'ADMIN_TARGET_PROTECTED';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function classify(error: unknown): ModerationActionError {
  if (error instanceof ModerationActionError) return error;
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) return new ModerationActionError('unauthenticated');
    if (error.status === 403) {
      const code = isRecord(error.error) ? error.error['code'] : undefined;
      return new ModerationActionError(
        code === ADMIN_TARGET_PROTECTED ? 'target-protected' : 'forbidden',
      );
    }
    if (error.status === 404) return new ModerationActionError('not-found');
    if (error.status === 409) return new ModerationActionError('conflict');
    if (error.status === 400 || error.status === 422) return new ModerationActionError('invalid');
    if (error.status === 429) return new ModerationActionError('rate-limited');
  }
  return new ModerationActionError('unavailable');
}

function str(value: unknown, max = 4000): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function isStatus(value: unknown): value is FlaggedMomentStatus {
  return FLAGGED_MOMENT_STATUSES.some((status) => status === value);
}

function parseSuspension(value: unknown): ActiveSuspension | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const id = str(value['id'], 64);
  const expiresAt = str(value['expiresAt'], 64);
  return id !== null && expiresAt !== null ? { id, expiresAt } : undefined;
}

function parseItem(value: unknown): FlaggedMomentItem | null {
  if (!isRecord(value)) return null;
  const reporter = value['reporter'];
  const author = value['author'];
  const moment = value['moment'];
  if (!isRecord(reporter) || !isRecord(author) || !isRecord(moment)) return null;

  const reportId = str(value['reportId'], 64);
  const createdAt = str(value['createdAt'], 64);
  const status = value['status'];
  const authorId = str(author['id'], 64);
  const momentId = str(moment['id'], 64);
  const suspension = parseSuspension(author['activeSuspension']);
  const mediaUrls = moment['mediaUrls'];
  if (
    reportId === null ||
    createdAt === null ||
    !isStatus(status) ||
    authorId === null ||
    momentId === null ||
    suspension === undefined ||
    !Array.isArray(mediaUrls) ||
    mediaUrls.length > 4 ||
    !mediaUrls.every((url) => typeof url === 'string' && url.length <= 2048) ||
    typeof moment['available'] !== 'boolean'
  ) {
    return null;
  }

  return {
    reportId,
    status,
    reasonCategory: str(value['reasonCategory'], 100) ?? 'other',
    reportDescription: str(value['reportDescription'], 1000),
    createdAt,
    reporter: { id: str(reporter['id'], 64), displayName: str(reporter['displayName'], 200) },
    author: {
      id: authorId,
      displayName: str(author['displayName'], 200),
      activeSuspension: suspension,
    },
    moment: {
      id: momentId,
      excerpt: str(moment['excerpt'], 1000),
      available: moment['available'],
      postType: str(moment['postType'], 50),
      targetLanguage: str(moment['targetLanguage'], 50),
      mediaType: str(moment['mediaType'], 50),
      mediaUrls: mediaUrls.filter((url): url is string => typeof url === 'string'),
    },
  };
}

function parseList(value: unknown): FlaggedMomentList {
  if (!isRecord(value) || !Array.isArray(value['items'])) {
    throw new ModerationActionError('unavailable');
  }
  const items = value['items'].map(parseItem);
  const total = value['total'];
  const page = value['page'];
  const pageSize = value['pageSize'];
  if (
    items.some((item) => item === null) ||
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(pageSize)
  ) {
    throw new ModerationActionError('unavailable');
  }
  return {
    items: items.filter((item): item is FlaggedMomentItem => item !== null),
    total: Number(total),
    page: Number(page),
    pageSize: Number(pageSize),
  };
}

function parseResolve(value: unknown): ResolveResult {
  if (
    !isRecord(value) ||
    typeof value['reportId'] !== 'string' ||
    !isStatus(value['status']) ||
    typeof value['replayed'] !== 'boolean'
  ) {
    throw new ModerationActionError('unavailable');
  }
  return { reportId: value['reportId'], status: value['status'], replayed: value['replayed'] };
}

function parseSuspensionOutcome(value: unknown): { id: string; expiresAt: string; replayed: boolean } {
  const suspension = isRecord(value) ? value['suspension'] : undefined;
  if (
    !isRecord(value) ||
    !isRecord(suspension) ||
    typeof suspension['id'] !== 'string' ||
    typeof suspension['expiresAt'] !== 'string' ||
    typeof value['replayed'] !== 'boolean'
  ) {
    throw new ModerationActionError('unavailable');
  }
  return {
    id: suspension['id'],
    expiresAt: suspension['expiresAt'],
    replayed: value['replayed'],
  };
}

@Injectable({ providedIn: 'root' })
export class AdminFlaggedMomentsService {
  private readonly http = inject(HttpClient);
  private readonly login = inject(AdminLoginService);

  list(query: {
    page: number;
    pageSize: number;
    status: FlaggedMomentStatus;
  }): Observable<FlaggedMomentList> {
    const params = new HttpParams()
      .set('page', String(query.page))
      .set('pageSize', String(query.pageSize))
      .set('status', query.status);
    return this.request((base, headers) =>
      this.http.get<unknown>(`${base}/admin/v1/moderation/flagged-moments`, { headers, params }),
    ).pipe(map(parseList));
  }

  resolve(
    reportId: string,
    input: { decision: FlaggedMomentDecision; reasonCode: ModerationReasonCode; operatorNote?: string },
  ): Observable<ResolveResult> {
    return this.request((base, headers) =>
      this.http.post<unknown>(
        `${base}/admin/v1/moderation/flagged-moments/${encodeURIComponent(reportId)}/resolve`,
        input,
        { headers },
      ),
    ).pipe(map(parseResolve));
  }

  suspend(
    userId: string,
    input: {
      expiresAt: string;
      reasonCode: ModerationReasonCode;
      operatorNote?: string;
      reportId?: string;
      idempotencyKey: string;
    },
  ): Observable<SuspensionResult> {
    return this.request((base, headers) =>
      this.http.post<unknown>(
        `${base}/admin/v1/moderation/users/${encodeURIComponent(userId)}/suspensions`,
        input,
        { headers },
      ),
    ).pipe(
      map(parseSuspensionOutcome),
      map((outcome) => ({
        suspensionId: outcome.id,
        expiresAt: outcome.expiresAt,
        replayed: outcome.replayed,
      })),
    );
  }

  lift(
    suspensionId: string,
    input: { reasonCode: ModerationReasonCode; operatorNote?: string },
  ): Observable<LiftResult> {
    return this.request((base, headers) =>
      this.http.post<unknown>(
        `${base}/admin/v1/moderation/suspensions/${encodeURIComponent(suspensionId)}/lift`,
        input,
        { headers },
      ),
    ).pipe(
      map(parseSuspensionOutcome),
      map((outcome) => ({ suspensionId: outcome.id, replayed: outcome.replayed })),
    );
  }

  private request(
    send: (apiBaseUrl: string, headers: HttpHeaders) => Observable<unknown>,
  ): Observable<unknown> {
    const token = this.login.accessToken();
    if (!token) {
      return throwError(() => new ModerationActionError('unauthenticated'));
    }

    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return from(this.login.apiBaseUrl()).pipe(
      switchMap((apiBaseUrl) => send(apiBaseUrl, headers)),
      catchError((error: unknown) => throwError(() => classify(error))),
    );
  }
}
