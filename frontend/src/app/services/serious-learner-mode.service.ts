import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

interface SeriousLearnerProfileState {
  serious_learner_mode?: boolean;
}

/**
 * App-level source of truth for the user's Serious Learner preference.
 *
 * The preference is persisted on the authenticated profile. Writes are verified
 * with a fresh read so a degraded/mock profile response cannot be mistaken for
 * a successful persistence operation.
 */
@Injectable({ providedIn: 'root' })
export class SeriousLearnerModeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly profileUrl = `${environment.apiUrl}/users/me`;
  private loadGeneration = 0;

  readonly enabled = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const userId = this.authService.currentUser()?.id ?? null;
      const generation = ++this.loadGeneration;

      this.enabled.set(false);
      this.error.set(null);

      if (!userId || !this.authService.getAccessToken()) {
        this.loading.set(false);
        return;
      }

      void this.loadForUser(userId, generation);
    });
  }

  async refresh(): Promise<void> {
    const userId = this.authService.currentUser()?.id;
    if (!userId || !this.authService.getAccessToken()) {
      this.enabled.set(false);
      this.loading.set(false);
      return;
    }

    await this.loadForUser(userId, ++this.loadGeneration);
  }

  async toggle(): Promise<boolean> {
    return this.setEnabled(!this.enabled());
  }

  async setEnabled(next: boolean): Promise<boolean> {
    const user = this.authService.currentUser();
    const token = this.authService.getAccessToken();
    if (!user || !token) {
      this.error.set('serious-learner-mode.auth-required');
      return false;
    }

    if (this.saving()) {
      return false;
    }

    const previous = this.enabled();
    const generation = ++this.loadGeneration;
    this.saving.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.http.patch<SeriousLearnerProfileState>(
          this.profileUrl,
          { serious_learner_mode: next },
          { headers: this.getHeaders(token) },
        ),
      );

      // Verify persistence independently. UsersService has legacy degraded/mock
      // fallbacks; accepting the PATCH response alone could report a false save.
      const verified = await firstValueFrom(
        this.http.get<SeriousLearnerProfileState>(this.profileUrl, {
          headers: this.getHeaders(token),
        }),
      );

      if (verified.serious_learner_mode !== next) {
        throw new Error('Serious Learner mode persistence verification failed');
      }

      if (generation === this.loadGeneration && this.authService.currentUser()?.id === user.id) {
        this.enabled.set(next);
      }
      return true;
    } catch {
      if (generation === this.loadGeneration && this.authService.currentUser()?.id === user.id) {
        this.enabled.set(previous);
        this.error.set('serious-learner-mode.save-failed');
      }
      return false;
    } finally {
      if (generation === this.loadGeneration) {
        this.saving.set(false);
      }
    }
  }

  private async loadForUser(userId: string, generation: number): Promise<void> {
    const token = this.authService.getAccessToken();
    if (!token) return;

    this.loading.set(true);
    try {
      const profile = await firstValueFrom(
        this.http.get<SeriousLearnerProfileState>(this.profileUrl, {
          headers: this.getHeaders(token),
        }),
      );

      if (generation === this.loadGeneration && this.authService.currentUser()?.id === userId) {
        this.enabled.set(profile.serious_learner_mode === true);
        this.error.set(null);
      }
    } catch {
      if (generation === this.loadGeneration && this.authService.currentUser()?.id === userId) {
        // Fail closed to ordinary mode. Social-feed suppression should never be
        // inferred from a mock/degraded profile response.
        this.enabled.set(false);
        this.error.set('serious-learner-mode.load-failed');
      }
    } finally {
      if (generation === this.loadGeneration) {
        this.loading.set(false);
      }
    }
  }

  private getHeaders(token: string): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
