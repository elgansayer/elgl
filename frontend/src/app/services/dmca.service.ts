import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type DmcaNoticeStatus =
  | 'pending_verification'
  | 'expired'
  | 'needs_review'
  | 'content_disabled'
  | 'counter_notice_received'
  | 'restored'
  | 'rejected'
  | 'withdrawn'
  | 'litigation_hold';

export const DMCA_NOTICE_STATUSES: readonly DmcaNoticeStatus[] = [
  'pending_verification',
  'expired',
  'needs_review',
  'content_disabled',
  'counter_notice_received',
  'restored',
  'rejected',
  'withdrawn',
  'litigation_hold',
];

export interface DmcaNoticePayload {
  readonly claimantName: string;
  readonly claimantEmail: string;
  readonly claimantOrganisation?: string;
  readonly claimantAddress?: string;
  readonly claimantPhone?: string;
  readonly copyrightedWork: string;
  readonly materialReferences: readonly string[];
  readonly goodFaithStatement: boolean;
  readonly accuracyStatement: boolean;
  readonly electronicSignature: string;
}

export interface DmcaSubmission {
  readonly references: readonly string[];
}

export interface DmcaVerificationItem {
  readonly reference: string;
  readonly status: DmcaNoticeStatus;
}

export interface OwnerNotice {
  readonly id: string;
  readonly reference: string;
  readonly status: DmcaNoticeStatus;
  readonly claimantName: string;
  readonly claimantOrganisation: string | null;
  readonly copyrightedWork: string;
  readonly contentDisabledAt: string | null;
  readonly counterNoticeAt: string | null;
  readonly restoreAfter: string | null;
  readonly canCounterNotice: boolean;
}

export interface CounterNoticePayload {
  readonly fullName: string;
  readonly address: string;
  readonly phone?: string;
  readonly goodFaithStatement: boolean;
  readonly jurisdictionConsent: boolean;
  readonly electronicSignature: string;
}

export type DmcaFailure = 'invalid' | 'rate_limited' | 'not_found' | 'gone' | 'conflict' | 'unavailable';

/** Groups an HTTP failure into the few outcomes the screens explain differently. */
export function classifyDmcaFailure(error: unknown): DmcaFailure {
  if (!(error instanceof HttpErrorResponse)) return 'unavailable';
  switch (error.status) {
    case 400:
      return 'invalid';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 410:
      return 'gone';
    case 429:
      return 'rate_limited';
    default:
      return 'unavailable';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DmcaNoticeStatus {
  return DMCA_NOTICE_STATUSES.some((status) => status === value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error('Invalid copyright notice response');
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('Invalid copyright notice response');
  return value;
}

function parseOwnerNotice(value: unknown): OwnerNotice {
  if (!isRecord(value) || !isStatus(value['status']) || typeof value['canCounterNotice'] !== 'boolean') {
    throw new Error('Invalid copyright notice response');
  }
  return {
    id: readString(value, 'id'),
    reference: readString(value, 'reference'),
    status: value['status'],
    claimantName: readString(value, 'claimantName'),
    claimantOrganisation: readNullableString(value, 'claimantOrganisation'),
    copyrightedWork: readString(value, 'copyrightedWork'),
    contentDisabledAt: readNullableString(value, 'contentDisabledAt'),
    counterNoticeAt: readNullableString(value, 'counterNoticeAt'),
    restoreAfter: readNullableString(value, 'restoreAfter'),
    canCounterNotice: value['canCounterNotice'],
  };
}

@Injectable({ providedIn: 'root' })
export class DmcaService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/dmca/notices`;

  /** Public: copyright owners do not need an account. */
  async submitNotice(payload: DmcaNoticePayload): Promise<DmcaSubmission> {
    const body: unknown = await firstValueFrom(this.http.post<unknown>(this.baseUrl, payload));
    if (!isRecord(body) || !Array.isArray(body['references'])) {
      throw new Error('Invalid copyright notice response');
    }
    const references: readonly unknown[] = body['references'];
    return {
      references: references.filter((entry): entry is string => typeof entry === 'string'),
    };
  }

  /** Public: the single-use token from the confirmation email. */
  async verifyNotice(token: string): Promise<readonly DmcaVerificationItem[]> {
    const body: unknown = await firstValueFrom(
      this.http.post<unknown>(`${this.baseUrl}/verify`, { token }),
    );
    if (!isRecord(body) || !Array.isArray(body['notices'])) {
      throw new Error('Invalid copyright notice response');
    }
    const notices: readonly unknown[] = body['notices'];
    return notices.map((entry) => {
      if (!isRecord(entry) || !isStatus(entry['status'])) {
        throw new Error('Invalid copyright notice response');
      }
      return { reference: readString(entry, 'reference'), status: entry['status'] };
    });
  }

  async listMine(): Promise<readonly OwnerNotice[]> {
    const body: unknown = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/mine`, {
        headers: this.authService.getBearerHeaders(),
      }),
    );
    if (!Array.isArray(body)) throw new Error('Invalid copyright notice response');
    const entries: readonly unknown[] = body;
    return entries.map((entry) => parseOwnerNotice(entry));
  }

  async fileCounterNotice(noticeId: string, payload: CounterNoticePayload): Promise<OwnerNotice> {
    const body: unknown = await firstValueFrom(
      this.http.post<unknown>(`${this.baseUrl}/${encodeURIComponent(noticeId)}/counter-notice`, payload, {
        headers: this.authService.getBearerHeaders(),
      }),
    );
    return parseOwnerNotice(body);
  }
}
