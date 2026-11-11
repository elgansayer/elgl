import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type AgeGateStatus = 'legacy' | 'required' | 'passed' | 'blocked_under_age';

/** What the API tells the client: never the minimum age or the stored date. */
export interface AgeGateView {
  readonly status: AgeGateStatus;
  readonly required: boolean;
  readonly blocked: boolean;
}

export const AGE_GATE_ERROR_CODES = {
  required: 'AGE_GATE_REQUIRED',
  blocked: 'AGE_GATE_BLOCKED',
  invalidDateOfBirth: 'INVALID_DATE_OF_BIRTH',
};

const STATUSES: readonly AgeGateStatus[] = ['legacy', 'required', 'passed', 'blocked_under_age'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is AgeGateStatus {
  return STATUSES.some((status) => status === value);
}

function parseView(payload: unknown): AgeGateView {
  if (
    !isRecord(payload) ||
    !isStatus(payload['status']) ||
    typeof payload['required'] !== 'boolean' ||
    typeof payload['blocked'] !== 'boolean'
  ) {
    throw new Error('Invalid age gate response');
  }
  return {
    status: payload['status'],
    required: payload['required'],
    blocked: payload['blocked'],
  };
}

/** The machine-readable code carried by an API error body, if any. */
export function readApiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || !isRecord(error.error)) return null;
  const code = error.error['code'];
  return typeof code === 'string' ? code : null;
}

@Injectable({ providedIn: 'root' })
export class AgeGateService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/age-gate`;

  /** Latest state seen from the API, either directly or via a rejected request. */
  readonly view = signal<AgeGateView | null>(null);
  readonly isBlocked = computed(() => this.view()?.blocked === true);
  readonly isRequired = computed(() => this.view()?.required === true);

  async loadStatus(): Promise<AgeGateView> {
    const payload: unknown = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/status`, {
        headers: this.authService.getBearerHeaders(),
      }),
    );
    return this.remember(parseView(payload));
  }

  /** Records a date of birth. The first declaration wins on the server. */
  async submit(dateOfBirth: string): Promise<AgeGateView> {
    const payload: unknown = await firstValueFrom(
      this.http.post<unknown>(
        this.baseUrl,
        { dateOfBirth },
        { headers: this.authService.getBearerHeaders() },
      ),
    );
    return this.remember(parseView(payload));
  }

  /** Called by the HTTP interceptor when any request is refused by the gate. */
  recordRejection(code: string): void {
    if (code === AGE_GATE_ERROR_CODES.blocked) {
      this.view.set({ status: 'blocked_under_age', required: false, blocked: true });
    } else if (code === AGE_GATE_ERROR_CODES.required) {
      this.view.set({ status: 'required', required: true, blocked: false });
    }
  }

  private remember(view: AgeGateView): AgeGateView {
    this.view.set(view);
    return view;
  }
}
