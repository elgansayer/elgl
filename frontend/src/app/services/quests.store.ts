import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  fetchQuests(): void {
    this.loading.set(true);
    this.http.get<Quest[]>(`${environment.apiUrl}/quests`).subscribe({
      next: (data) => {
        this.quests.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
