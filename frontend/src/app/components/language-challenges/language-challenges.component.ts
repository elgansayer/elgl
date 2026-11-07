import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTextarea } from '@spartan-ng/helm/textarea';
import { I18nService } from '../../services/i18n.service';
import {
  CreateLanguageChallengeRequest,
  LanguageChallenge,
  LanguageChallengesClient,
} from '../../services/language-challenges.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-challenges',
  imports: [CommonModule, FormsModule, HlmButton, HlmInput, HlmTextarea, TranslatePipe],
  template: `
    <main class="mx-auto w-full max-w-5xl p-4 text-start text-foreground sm:p-6">
      <header class="mb-6">
        <h1 class="text-2xl font-bold">{{ 'languageChallenges.title' | t }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ 'languageChallenges.intro' | t }}
        </p>
      </header>

      <section
        class="mb-8 rounded-sheet border border-border bg-card p-4 sm:p-5"
        aria-labelledby="create-challenge-heading"
      >
        <h2 id="create-challenge-heading" class="text-lg font-semibold">
          {{ 'languageChallenges.createHeading' | t }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ 'languageChallenges.createHint' | t }}
        </p>

        <form class="mt-4 grid gap-4" (ngSubmit)="createChallenge()">
          <label class="grid gap-1 text-sm font-medium">
            {{ 'languageChallenges.fieldTitle' | t }}
            <input
              hlmInput
              name="title"
              [(ngModel)]="draft.title"
              maxlength="120"
              required
              autocomplete="off"
            />
          </label>
          <label class="grid gap-1 text-sm font-medium">
            {{ 'languageChallenges.fieldDescription' | t }}
            <textarea
              hlmTextarea
              name="description"
              [(ngModel)]="draft.description"
              maxlength="1000"
              required
              rows="3"
            ></textarea>
          </label>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="grid gap-1 text-sm font-medium">
              {{ 'languageChallenges.fieldDuration' | t }}
              <input
                hlmInput
                name="durationDays"
                [(ngModel)]="draft.durationDays"
                type="number"
                min="1"
                max="30"
                required
              />
            </label>
            <label class="grid gap-1 text-sm font-medium">
              {{ 'languageChallenges.fieldEntryFee' | t }}
              <input
                hlmInput
                name="entryFeeCoins"
                [(ngModel)]="draft.entryFeeCoins"
                type="number"
                min="1"
                max="1000"
                required
              />
            </label>
          </div>
          <div>
            <button hlmBtn type="submit" [disabled]="creating()">
              {{ creating() ? ('languageChallenges.creating' | t) : ('languageChallenges.createSubmit' | t) }}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="available-challenges-heading">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="available-challenges-heading" class="text-xl font-semibold">
            {{ 'languageChallenges.available' | t }}
          </h2>
          <button
            hlmBtn
            variant="outline"
            type="button"
            (click)="refresh()"
            [disabled]="loading()"
          >
            {{ 'languageChallenges.refresh' | t }}
          </button>
        </div>

        @if (message()) {
          <p
            class="mb-3 rounded-md border border-border bg-muted p-3 text-sm"
            role="status"
            aria-live="polite"
          >
            {{ message() }}
          </p>
        }
        @if (error()) {
          <div
            class="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3"
            role="alert"
          >
            <p>{{ 'languageChallenges.loadError' | t }}</p>
            <button hlmBtn variant="outline" type="button" class="mt-2" (click)="refresh()">
              {{ 'common.retry' | t }}
            </button>
          </div>
        }

        @if (loading() && challenges().length === 0) {
          <p role="status" aria-live="polite">{{ 'languageChallenges.loading' | t }}</p>
        } @else {
          <ul class="grid gap-4" role="list">
            @for (challenge of challenges(); track challenge.id) {
              <li class="rounded-sheet border border-border bg-card p-4 sm:p-5">
                <article [attr.aria-labelledby]="'challenge-' + challenge.id">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3
                        class="break-words text-lg font-semibold"
                        [id]="'challenge-' + challenge.id"
                      >
                        {{ challenge.title }}
                      </h3>
                      <p class="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {{ challenge.description }}
                      </p>
                    </div>
                    <span class="rounded-full border border-border px-2 py-1 text-xs font-medium">
                      {{ statusLabel(challenge) }}
                    </span>
                  </div>

                  <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt class="text-muted-foreground">{{ 'languageChallenges.entryFee' | t }}</dt>
                      <dd class="font-semibold">
                        {{ 'languageChallenges.coinsAmount' | t: { count: challenge.entry_fee_coins } }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">{{ 'languageChallenges.prizePool' | t }}</dt>
                      <dd class="font-semibold">
                        {{ 'languageChallenges.coinsAmount' | t: { count: challenge.prize_pool_coins } }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">{{ 'languageChallenges.duration' | t }}</dt>
                      <dd class="font-semibold">
                        {{ 'languageChallenges.daysAmount' | t: { count: challenge.duration_days } }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">{{ 'languageChallenges.ends' | t }}</dt>
                      <dd class="font-semibold">{{ challenge.ends_at | date: 'medium' }}</dd>
                    </div>
                  </dl>

                  @if (challenge.joined) {
                    <div class="mt-4">
                      <div class="mb-1 flex justify-between gap-2 text-sm">
                        <span>{{ 'languageChallenges.progress' | t }}</span>
                        <span>
                          {{
                            'languageChallenges.progressDays'
                              | t: { current: challenge.progress_days, total: challenge.duration_days }
                          }}
                        </span>
                      </div>
                      <div
                        class="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        [attr.aria-valuenow]="challenge.progress_days"
                        aria-valuemin="0"
                        [attr.aria-valuemax]="challenge.duration_days"
                        [attr.aria-label]="
                          'languageChallenges.progressAria'
                            | t: { current: challenge.progress_days, total: challenge.duration_days }
                        "
                      >
                        <div
                          class="h-full rounded-full bg-primary"
                          [style.width.%]="progressPercent(challenge)"
                        ></div>
                      </div>
                    </div>
                  }

                  <div class="mt-4 flex flex-wrap gap-2">
                    @if (!challenge.joined && !challenge.ended && challenge.status === 'open') {
                      @if (pendingJoinId() === challenge.id) {
                        <p class="basis-full text-sm font-medium">
                          {{
                            'languageChallenges.confirmSpend'
                              | t: { count: challenge.entry_fee_coins }
                          }}
                        </p>
                        <button
                          hlmBtn
                          type="button"
                          (click)="confirmJoin(challenge)"
                          [disabled]="busyId() === challenge.id"
                        >
                          {{ 'languageChallenges.confirmJoin' | t }}
                        </button>
                        <button
                          hlmBtn
                          variant="outline"
                          type="button"
                          (click)="pendingJoinId.set(null)"
                          [disabled]="busyId() === challenge.id"
                        >
                          {{ 'common.cancel' | t }}
                        </button>
                      } @else {
                        <button
                          hlmBtn
                          type="button"
                          (click)="pendingJoinId.set(challenge.id)"
                        >
                          {{ 'languageChallenges.joinFor' | t: { count: challenge.entry_fee_coins } }}
                        </button>
                      }
                    }
                    @if (
                      challenge.joined &&
                      !challenge.ended &&
                      challenge.participant_status === 'active'
                    ) {
                      <button
                        hlmBtn
                        type="button"
                        (click)="checkIn(challenge)"
                        [disabled]="busyId() === challenge.id"
                      >
                        {{ 'languageChallenges.checkIn' | t }}
                      </button>
                    }
                    @if (challenge.joined && challenge.ended && challenge.status === 'open') {
                      <button
                        hlmBtn
                        type="button"
                        (click)="claim(challenge)"
                        [disabled]="busyId() === challenge.id"
                      >
                        {{ 'languageChallenges.claim' | t }}
                      </button>
                    }
                    @if (challenge.participant_status === 'completed') {
                      <span class="self-center text-sm font-semibold">
                        {{ 'languageChallenges.completed' | t: { count: challenge.prize_coins } }}
                      </span>
                    } @else if (challenge.participant_status === 'failed') {
                      <span class="self-center text-sm font-semibold">
                        {{ 'languageChallenges.failed' | t }}
                      </span>
                    }
                  </div>
                </article>
              </li>
            } @empty {
              @if (!error()) {
                <li
                  class="rounded-sheet border border-border bg-card p-5 text-sm text-muted-foreground"
                  role="status"
                >
                  {{ 'languageChallenges.empty' | t }}
                </li>
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
  private readonly i18n = inject(I18nService);
  readonly challenges = signal<LanguageChallenge[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal(false);
  readonly message = signal('');
  readonly busyId = signal<string | null>(null);
  readonly pendingJoinId = signal<string | null>(null);

  readonly draft: CreateLanguageChallengeRequest = {
    title: this.i18n.translate('languageChallenges.defaultTitle'),
    description: this.i18n.translate('languageChallenges.defaultDescription'),
    durationDays: 7,
    entryFeeCoins: 25,
    challengeType: 'streak',
  };

  constructor() {
    void this.refresh();
  }

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
      this.message.set(this.i18n.translate('languageChallenges.created'));
      await this.refresh();
    } catch {
      this.message.set(this.i18n.translate('languageChallenges.createFailed'));
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
          ? this.i18n.translate('languageChallenges.alreadyJoined')
          : this.i18n.translate('languageChallenges.joined', { coins: result.coinsRemaining }),
      );
      this.pendingJoinId.set(null);
      await this.refresh();
    } catch {
      this.message.set(this.i18n.translate('languageChallenges.joinFailed'));
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
          ? this.i18n.translate('languageChallenges.alreadyCheckedIn')
          : this.i18n.translate('languageChallenges.checkedIn', {
              progress: result.progressDays,
              target: result.targetDays,
            }),
      );
      await this.refresh();
    } catch {
      this.message.set(this.i18n.translate('languageChallenges.checkInFailed'));
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
      this.message.set(this.i18n.translate('languageChallenges.settled', { coins: result.prizeCoins }));
      await this.refresh();
    } catch {
      this.message.set(this.i18n.translate('languageChallenges.claimFailed'));
    } finally {
      this.busyId.set(null);
    }
  }

  progressPercent(challenge: LanguageChallenge): number {
    if (challenge.duration_days <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, (challenge.progress_days / challenge.duration_days) * 100),
    );
  }

  statusLabel(challenge: LanguageChallenge): string {
    if (challenge.status === 'completed') return this.i18n.translate('languageChallenges.statusCompleted');
    if (challenge.ended) return this.i18n.translate('languageChallenges.statusEnded');
    return this.i18n.translate('languageChallenges.statusOpen');
  }
}
