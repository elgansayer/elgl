import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Quest {
  id: string;
  quest_type: 'daily' | 'weekly';
  quest_key: 'correct_moments' | 'post_moment';
  progress: number;
  target: number;
  reward_coins: number;
  completed: boolean;
  period_start: string;
  reward_claimed_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class QuestStore {
  private http = inject(HttpClient);
  private requestVersion = 0;

  readonly quests = signal<Quest[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  async fetchQuests(): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(false);

    try {
      const data = await firstValueFrom(
        this.http.get<Quest[]>(`${environment.apiUrl}/quests`),
      );
      if (requestVersion !== this.requestVersion) return;
      this.quests.set(Array.isArray(data) ? data : []);
    } catch {
      if (requestVersion !== this.requestVersion) return;
      // Preserve previously loaded quests during a transient failure rather
      // than presenting a genuine server error as an empty quest list.
      this.error.set(true);
    } finally {
      if (requestVersion === this.requestVersion) {
        this.loading.set(false);
      }
    }
  }
}
