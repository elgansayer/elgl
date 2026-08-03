import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  completedAt?: string | null;
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
  private readonly apiUrl = `${environment.apiUrl}/milestones`;

  getMilestones(): Promise<Milestone[]> {
    return firstValueFrom(this.http.get<Milestone[]>(this.apiUrl));
  }

  getProgress(): Promise<MilestoneProgress> {
    return firstValueFrom(
      this.http.get<MilestoneProgress>(`${this.apiUrl}/progress`),
    );
  }

  createMilestone(title: string, description?: string): Promise<Milestone> {
    return firstValueFrom(
      this.http.post<Milestone>(this.apiUrl, { title, description }),
    );
  }

  markCompleted(id: string): Promise<Milestone> {
    return firstValueFrom(
      this.http.post<Milestone>(`${this.apiUrl}/${id}/complete`, {}),
    );
  }

  deleteMilestone(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
  }
}
