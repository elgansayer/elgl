import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Quest {
  id: string;
  quest_type: 'daily' | 'weekly';
  quest_key: string;
  progress: number;
  target: number;
  reward_coins: number;
  completed: boolean;
}

@Injectable({ providedIn: 'root' })
export class QuestStore {
  private http = inject(HttpClient);
  readonly quests = signal<Quest[]>([]);
  readonly loading = signal(false);

  async fetchQuests(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<Quest[]>(`${environment.apiUrl}/quests`),
      );
      this.quests.set(data);
    } catch {
      this.quests.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
