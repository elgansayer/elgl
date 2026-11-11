import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ExchangeTimerParticipant {
  userId: string;
  language: string | null;
  turnsTaken: number;
}

export interface ExchangeTimerStatus {
  active: boolean;
  waitingForParticipant: boolean;
  reciprocal: boolean;
  roomName: string;
  turnDurationSeconds: number;
  turnIndex: number;
  currentSpeakerId: string | null;
  currentSpeakerLanguage: string | null;
  remainingSeconds: number;
  isCurrentSpeaker: boolean;
  participants: ExchangeTimerParticipant[];
}

const POLL_INTERVAL_MS = 2000;
const COUNTDOWN_INTERVAL_MS = 1000;

@Injectable({
  providedIn: 'root',
})
export class ExchangeTimerService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ExchangeTimerStatus | null>(null);
  readonly remainingSeconds = signal(0);
  readonly unavailable = signal(false);

  readonly isActive = computed(() => this.status()?.active ?? false);
  readonly isWaitingForParticipant = computed(
    () => this.status()?.waitingForParticipant ?? false,
  );
  readonly isMyTurn = computed(() => this.status()?.isCurrentSpeaker ?? false);
  readonly canSpeak = computed(() => !this.isActive() || this.isMyTurn());
  readonly currentSpeakerLanguage = computed(
    () => this.status()?.currentSpeakerLanguage ?? null,
  );
  readonly reciprocal = computed(() => this.status()?.reciprocal ?? false);

  private roomName: string | null = null;
  private fetchedAt = 0;
  private pollSubscription: Subscription | null = null;
  private countdownSubscription: Subscription | null = null;

  async start(roomName: string): Promise<void> {
    this.stop();
    this.roomName = roomName;
    await this.refresh();
    this.startTimers();
  }

  stop(): void {
    this.roomName = null;
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.countdownSubscription?.unsubscribe();
    this.countdownSubscription = null;
    this.fetchedAt = 0;
    this.status.set(null);
    this.remainingSeconds.set(0);
    this.unavailable.set(false);
  }

  async refresh(): Promise<void> {
    const roomName = this.roomName;
    if (!roomName) return;

    try {
      const response = await firstValueFrom(
        this.http.get<ExchangeTimerStatus>(
          `${environment.apiUrl}/video-calls/${roomName}/exchange-timer`,
          { headers: this.authHeaders() },
        ),
      );
      this.status.set(response);
      this.remainingSeconds.set(Math.max(0, response.remainingSeconds));
      this.fetchedAt = Date.now();
      this.unavailable.set(false);
    } catch {
      this.unavailable.set(true);
    }
  }

  async advanceTurn(): Promise<boolean> {
    const roomName = this.roomName;
    const current = this.status();
    if (!roomName || !current?.active) return false;

    try {
      const response = await firstValueFrom(
        this.http.put<ExchangeTimerStatus>(
          `${environment.apiUrl}/video-calls/${roomName}/exchange-timer/advance`,
          { expectedTurnIndex: current.turnIndex },
          { headers: this.authHeaders() },
        ),
      );
      this.status.set(response);
      this.remainingSeconds.set(Math.max(0, response.remainingSeconds));
      this.fetchedAt = Date.now();
      this.unavailable.set(false);
      return true;
    } catch {
      this.unavailable.set(true);
      return false;
    }
  }

  private startTimers(): void {
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.refresh();
      });

    this.countdownSubscription = interval(COUNTDOWN_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const current = this.status();
        if (!current?.active || this.fetchedAt === 0) return;

        const elapsedSinceFetch = Math.floor(
          (Date.now() - this.fetchedAt) / 1000,
        );
        this.remainingSeconds.set(
          Math.max(0, current.remainingSeconds - elapsedSinceFetch),
        );
      });
  }

  private authHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
