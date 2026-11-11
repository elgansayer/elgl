import { Injectable, inject, signal } from '@angular/core';
import { I18nService } from './i18n.service';
import { showErrorToast } from './toast.service';

/** Machine-readable code of the API's HTTP 403 for a suspended account. */
export const ACCOUNT_SUSPENDED_CODE = 'ACCOUNT_SUSPENDED';

/** A page load fires several requests at once; explain the restriction once, not per request. */
const NOTICE_INTERVAL_MS = 30_000;
const NOTICE_DURATION_MS = 8_000;

/**
 * Explains an operator-imposed suspension. The API answers every request from a
 * suspended account with HTTP 403 and the end time only: the reason and any
 * private notes never reach the client.
 */
@Injectable({ providedIn: 'root' })
export class AccountSuspensionNoticeService {
  private readonly i18n = inject(I18nService);
  private lastNoticeAt = 0;

  /** When the suspension the API last reported ends, for UI that wants to show it. */
  readonly suspendedUntil = signal<Date | null>(null);

  /** Accepts the 403 body; anything that is not the suspension contract is ignored. */
  handle(body: unknown): void {
    if (typeof body !== 'object' || body === null) return;
    if (!('code' in body) || body.code !== ACCOUNT_SUSPENDED_CODE) return;

    const until = this.readEnd(body);
    this.suspendedUntil.set(until);

    const now = Date.now();
    if (now - this.lastNoticeAt < NOTICE_INTERVAL_MS) return;
    this.lastNoticeAt = now;

    showErrorToast(
      until
        ? this.i18n.translate('account.suspendedUntil', { date: this.format(until) })
        : this.i18n.translate('account.suspended'),
      NOTICE_DURATION_MS,
    );
  }

  private readEnd(body: object): Date | null {
    if (!('suspendedUntil' in body) || typeof body.suspendedUntil !== 'string') return null;
    const date = new Date(body.suspendedUntil);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private format(date: Date): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    );
  }
}
