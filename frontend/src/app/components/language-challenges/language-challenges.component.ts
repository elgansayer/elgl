import { CommonModule } from '@angular/common';
import { Component, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import {
  CreateLanguageChallengeRequest,
  LanguageChallenge,
  LanguageChallengesClient,
} from '../../services/language-challenges.service';

@Component({
  selector: 'app-language-challenges',
  imports: [CommonModule, FormsModule, HlmButton, HlmInput],
  template: `
    <main class="mx-auto w-full max-w-5xl p-4 sm:p-6 text-start text-foreground">
      <header class="mb-6">
        <h1 class="text-2xl font-bold">Language challenges</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Build a study streak, pay an entry fee from your coin balance, and share the prize pool with everyone who finishes.
        </p>
      </header>

      <section class="mb-8 rounded-sheet border border-border bg-card p-4 sm:p-5" aria-labelledby="create-challenge-heading">
        <h2 id="create-challenge-heading" class="text-lg font-semibold">Create a challenge</h2>
        <p class="mt-1 text-sm text-muted-foreground">Challenges run on UTC days. Entry fees are charged only when a learner joins.</p>

        <form class="mt-4 grid gap-4" (ngSubmit)="createChallenge()">
          <label class="grid gap-1 text-sm font-medium">
            Title
            <input hlmInput name="title" [(ngModel)]="draft.title" maxlength="120" required autocomplete="off" />
          </label>
          <label class="grid gap-1 text-sm font-medium">
            Description
            <textarea hlmInput name="description" [(ngModel)]="draft.description" maxlength="1000" required rows="3"></textarea>
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-1 text-sm font-medium">
              Duration in days
              <input hlmInput name="durationDays" [(ngModel)]="draft.durationDays" type="number" min="1" max="30" required />
            </label>
            <label class="grid gap-1 text-sm font-medium">
              Entry fee in coins
              <input hlmInput name="entryFeeCoins" [(ngModel)]="draft.entryFeeCoins" type="number" min="1" max="1000" required />
            </label>
          </div>
          <div>
            <button hlmBtn type="submit" [disabled]="creating()">{{ creating() ? 'Creating…' : 'Create challenge' }}</button>
          </div>
        </form>
      </section>

      <section aria-labelledby="available-challenges-heading">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="available-challenges-heading" class="text-xl font-semibold">Available challenges</h2>
          <button hlmBtn variant="outline" type="button" (click)="refresh()" [disabled]="loading()">Refresh</button>
        </div>

        @if (message()) {
          <p class="mb-3 rounded-md border border-border bg-muted p-3 text-sm" role="status" aria-live="polite">{{ message() }}</p>
        }
        @if (error()) {
          <div class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3" role="alert">
            <p>Challenges could not be loaded. Your existing progress has been kept.</p>
            <button hlmBtn variant="outline" type="button" class="mt-2" (click)="refresh()">Retry</button>
          </div>
        }

        @if (loading() && challenges().length === 0) {
          <p role="status" aria-live="polite">Loading challenges…</p>
        } @else {
          <ul class="grid gap-4" role="list">
            @for (challenge of challenges(); track challenge.id) {
              <li class="rounded-sheet border border-border bg-card p-4 sm:p-5">
                <article [attr.aria-labelledby]="'challenge-' + challenge.id">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="break-words text-lg font-semibold" [id]="'challenge-' + challenge.id">{{ challenge.title }}</h3>
                      <p class="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{{ challenge.description }}</p>
                    </div>
                    <span class="rounded-full border border-border px-2 py-1 text-xs font-medium">
                      {{ statusLabel(challenge) }}
                    </span>
                  </div>

                  <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <div><dt class="text-muted-foreground">Entry fee</dt><dd class="font-semibold">{{ challenge.entry_fee_coins }} coins</dd></div>
                    <div><dt class="text-muted-foreground">Prize pool</dt><dd class="font-semibold">{{ challenge.prize_pool_coins }} coins</dd></div>
                    <div><dt class="text-muted-foreground">Duration</dt><dd class="font-semibold">{{ challenge.duration_days }} days</dd></div>
                    <div><dt class="text-muted-foreground">Ends</dt><dd class="font-semibold">{{ challenge.ends_at | date:'medium' }}</dd></div>
                  </dl>

                  @if (challenge.joined) {
                    <div class="mt-4">
                      <div class="mb-1 flex justify-between gap-2 text-sm">
                        <span>Progress</span>
                        <span>{{ challenge.progress_days }} / {{ challenge.duration_days }} days</span>
                      </div>
                      <div class="h-2 overflow-hidden rounded-full bg-muted" role="progressbar"
                        [attr.aria-valuenow]="challenge.progress_days" aria-valuemin="0"
                        [attr.aria-valuemax]="challenge.duration_days"
                        [attr.aria-label]="challenge.progress_days + ' of ' + challenge.duration_days + ' challenge days complete'">
                        <div class="h-full rounded-full bg-primary" [style.width.%]="progressPercent(challenge)"></div>
                      </div>
                    </div>
                  }

                  <div class="mt-4 flex flex-wrap gap-2">
                    @if (!challenge.joined && !challenge.ended && challenge.status === 'open') {
                      @if (pendingJoinId() === challenge.id) {
                        <p class="basis-full text-sm font-medium">Confirm spending {{ challenge.entry_fee_coins }} coins to join. This cannot be undone.</p>
                        <button hlmBtn type="button" (click)="confirmJoin(challenge)" [disabled]="busyId() === challenge.id">Confirm join</button>
                        <button hlmBtn variant="outline" type="button" (click)="pendingJoinId.set(null)" [disabled]="busyId() === challenge.id">Cancel</button>
                      } @else {
                        <button hlmBtn type="button" (click)="pendingJoinId.set(challenge.id)">Join for {{ challenge.entry_fee_coins }} coins</button>
                      }
                    }
                    @if (challenge.joined && !challenge.ended && challenge.participant_status === 'active') {
                      <button hlmBtn type="button" (click)="checkIn(challenge)" [disabled]="busyId() === challenge.id">Check in today</button>
                    }
                    @if (challenge.joined && challenge.ended && challenge.status === 'open') {
                      <button hlmBtn type="button" (click)="claim(challenge)" [disabled]="busyId() === challenge.id">Claim prize</button>
                    }
                    @if (challenge.participant_status === 'completed') {
                      <span class="self-center text-sm font-semibold">Completed · {{ challenge.prize_coins }} coins awarded</span>
                    } @else if (challenge.participant_status === 'failed') {
                      <span class="self-center text-sm font-semibold">Challenge ended before you completed the streak.</span>
                    }
                  </div>
                </article>
              </li>
            } @empty {
              @if (!error()) {
                <li class="rounded-sheet border border-border bg-card p-5 text-sm text-muted-foreground" role="status">No challenges are available yet. Create the first one.</li>
              }
            }
          </ul>
        }
      </section>
    </main>
  `,
})
export class LanguageChallengesComponent {
  private readonly client = inject(LanguageChallengesClient);
  readonly challenges = signal<LanguageChallenge[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal(false);
  readonly message = signal('');
  readonly busyId = signal<string | null>(null);
  readonly pendingJoinId = signal<string | null>(null);

  readonly draft: CreateLanguageChallengeRequest = {
    title: '7-day writing streak',
    description: 'Practise your target language every day for seven UTC days.',
    durationDays: 7,
    entryFeeCoins: 25,
    challengeType: 'streak',
  };

  private readonly challengeResource = resource({ loader: () => this.refresh() });

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const rows = await this.client.list(50, 0);
      this.challenges.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async createChallenge(): Promise<void> {
    const title = this.draft.title.trim();
    const description = this.draft.description.trim();
    const durationDays = Number(this.draft.durationDays);
    const entryFeeCoins = Number(this.draft.entryFeeCoins);
    if (!title || !description || title.length > 120 || description.length > 1000) return;
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) return;
    if (!Number.isInteger(entryFeeCoins) || entryFeeCoins < 1 || entryFeeCoins > 1000) return;

    this.creating.set(true);
    this.message.set('');
    try {
      await this.client.create({
        title,
        description,
        durationDays,
        entryFeeCoins,
        challengeType: 'streak',
      });
      this.message.set('Challenge created. Join it to contribute your entry fee to the prize pool.');
      await this.refresh();
    } catch {
      this.message.set('The challenge could not be created. Please try again.');
    } finally {
      this.creating.set(false);
    }
  }

  async confirmJoin(challenge: LanguageChallenge): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(challenge.id);
    this.message.set('');
    try {
      const result = await this.client.join(challenge.id);
      this.message.set(
        result.alreadyJoined
          ? 'You already joined this challenge.'
          : `Joined successfully. ${result.coinsRemaining} coins remain in your balance.`,
      );
      this.pendingJoinId.set(null);
      await this.refresh();
    } catch {
      this.message.set('The challenge could not be joined. Check your coin balance and try again.');
    } finally {
      this.busyId.set(null);
    }
  }

  async checkIn(challenge: LanguageChallenge): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(challenge.id);
    this.message.set('');
    try {
      const result = await this.client.checkIn(challenge.id);
      this.message.set(
        result.alreadyCheckedIn
          ? 'Today is already counted for this challenge.'
          : `Check-in recorded: ${result.progressDays} of ${result.targetDays} days complete.`,
      );
      await this.refresh();
    } catch {
      this.message.set('Today’s check-in could not be recorded. Please try again.');
    } finally {
      this.busyId.set(null);
    }
  }

  async claim(challenge: LanguageChallenge): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(challenge.id);
    this.message.set('');
    try {
      const result = await this.client.claim(challenge.id);
      this.message.set(`Challenge settled. You received ${result.prizeCoins} coins.`);
      await this.refresh();
    } catch {
      this.message.set('The prize cannot be claimed yet. Make sure every required day is complete.');
    } finally {
      this.busyId.set(null);
    }
  }

  progressPercent(challenge: LanguageChallenge): number {
    if (challenge.duration_days <= 0) return 0;
    return Math.max(0, Math.min(100, (challenge.progress_days / challenge.duration_days) * 100));
  }

  statusLabel(challenge: LanguageChallenge): string {
    if (challenge.status === 'completed') return 'Completed';
    if (challenge.ended) return 'Ended';
    return 'Open';
  }
}
