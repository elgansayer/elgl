import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface SeriousLearnerProfileState {
  serious_learner_mode?: boolean;
}

export type SeriousLearnerModeError = 'load_failed' | 'save_failed' | 'unauthenticated' | null;

/**
 * Canonical app-level state for the user's Serious Learner mode preference.
 *
 * The preference is deliberately not stored in localStorage. It is scoped to
 * the authenticated account, loaded once when that account becomes active and
 * persisted through the profile API. Page components consume this service
 * instead of independently reloading or shadowing the preference.
 */
@Injectable({ providedIn: 'root' })
export class SeriousLearnerModeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly profileUrl = `${environment.apiUrl}/users/me`;

  readonly enabled = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<SeriousLearnerModeError>(null);
  readonly socialFeedsHidden = computed(() => this.enabled());
  readonly ready = computed(() => !this.loading());

  private activeUserId: string | null = null;
  private generation = 0;

  constructor() {
    effect(() => {
      const userId = this.authService.currentUser()?.id ?? null;
      untracked(() => this.onAuthenticatedUserChanged(userId));
    });
  }

  async setEnabled(nextEnabled: boolean): Promise<boolean> {
    const userId = this.authService.currentUser()?.id ?? null;
    const token = this.authService.getAccessToken();
    if (!userId || !token) {
      this.error.set('unauthenticated');
      return false;
    }
    if (this.saving()) return false;
    if (this.ready() && this.enabled() === nextEnabled) return true;

    const expectedGeneration = this.generation;
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.patch<SeriousLearnerProfileState>(
          this.profileUrl,
          { serious_learner_mode: nextEnabled },
          { headers: this.headers(token) },
        ),
      );

      // Verify the persisted value. The legacy profile API has degradation
      // fallbacks for several settings; Serious Learner mode must not report a
      // successful toggle unless a subsequent authenticated read confirms it.
      const persisted = await firstValueFrom(
        this.http.get<SeriousLearnerProfileState>(this.profileUrl, {
          headers: this.headers(token),
        }),
      );

      if (
        this.generation !== expectedGeneration ||
        this.activeUserId !== userId ||
        typeof persisted.serious_learner_mode !== 'boolean' ||
        persisted.serious_learner_mode !== nextEnabled
      ) {
        throw new Error('Serious Learner mode persistence verification failed');
      }

      this.enabled.set(nextEnabled);
      return true;
    } catch {
      if (this.generation === expectedGeneration && this.activeUserId === userId) {
        this.error.set('save_failed');
      }
      return false;
    } finally {
      if (this.generation === expectedGeneration && this.activeUserId === userId) {
        this.saving.set(false);
      }
    }
  }

  async refresh(): Promise<void> {
    const userId = this.authService.currentUser()?.id ?? null;
    if (!userId) {
      this.resetForNoUser();
      return;
    }
    await this.loadForUser(userId, ++this.generation);
  }

  private onAuthenticatedUserChanged(userId: string | null): void {
    if (userId === this.activeUserId) return;

    this.activeUserId = userId;
    const expectedGeneration = ++this.generation;
    this.enabled.set(false);
    this.error.set(null);
    this.saving.set(false);

    if (!userId) {
      this.loading.set(false);
      return;
    }

    void this.loadForUser(userId, expectedGeneration);
  }

  private async loadForUser(userId: string, expectedGeneration: number): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) {
      if (this.generation === expectedGeneration && this.activeUserId === userId) {
        this.loading.set(false);
        this.error.set('unauthenticated');
      }
      return;
    }

    this.loading.set(true);
    try {
      const profile = await firstValueFrom(
        this.http.get<SeriousLearnerProfileState>(this.profileUrl, {
          headers: this.headers(token),
        }),
      );
      if (this.generation !== expectedGeneration || this.activeUserId !== userId) return;

      this.enabled.set(profile.serious_learner_mode === true);
      this.error.set(null);
    } catch {
      if (this.generation !== expectedGeneration || this.activeUserId !== userId) return;
      this.enabled.set(false);
      this.error.set('load_failed');
    } finally {
      if (this.generation === expectedGeneration && this.activeUserId === userId) {
        this.loading.set(false);
      }
    }
  }

  private resetForNoUser(): void {
    this.activeUserId = null;
    this.generation += 1;
    this.enabled.set(false);
    this.loading.set(false);
    this.saving.set(false);
    this.error.set(null);
  }

  private headers(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }
}
