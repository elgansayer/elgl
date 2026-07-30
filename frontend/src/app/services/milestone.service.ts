import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt?: string;
}

export interface MilestoneProgress {
  total: number;
  completed: number;
  percentage: number;
}

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  private http = inject(HttpClient);
  readonly milestones = signal<Milestone[]>([]);
  readonly progress = signal<MilestoneProgress>({ total: 0, completed: 0, percentage: 0 });

  async fetchMilestones() {
    try {
      const data = await firstValueFrom(
        this.http.get<Milestone[]>(`${environment.apiUrl}/milestones`),
      );
      this.milestones.set(data ?? []);
    } catch {
      // fallback mock data
      this.milestones.set([
        { id: '1', title: 'Complete 10 flashcards', completed: false },
        { id: '2', title: 'Have 5 voice conversations', completed: false },
      ]);
    }
  }

  async getProgress() {
    try {
      const data = await firstValueFrom(
        this.http.get<MilestoneProgress>(`${environment.apiUrl}/milestones/progress`),
      );
      if (data) this.progress.set(data);
    } catch {
      // ignore
    }
  }
}
