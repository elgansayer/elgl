import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-streak-counter',
  imports: [TranslatePipe],
  templateUrl: './streak-counter.component.html',
})
export class StreakCounterComponent {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  readonly streak = signal<number>(0);

  constructor() {
    this.loadStreak();
  }

  private async loadStreak(): Promise<void> {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return;
    const streakCount = await this.supabaseService.getDailyStreak(userId);
    this.streak.set(streakCount);
  }
}
