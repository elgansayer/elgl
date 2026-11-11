import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthContextService } from '../admin-auth-context.service';
import {
  AdminFlaggedMomentsService,
  FlaggedMomentItem,
  FlaggedMomentStatus,
  MODERATION_REASONS,
  ModerationActionError,
  ModerationReasonCode,
} from '../admin-flagged-moments.service';

type ReviewAction = 'dismiss' | 'uphold' | 'suspend' | 'lift';

interface ActiveReview {
  reportId: string;
  action: ReviewAction;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<FlaggedMomentStatus, string> = {
  pending: 'Awaiting review',
  approved: 'Dismissed (no violation)',
  rejected: 'Upheld (violation confirmed)',
};

const ACTION_TITLES: Record<ReviewAction, string> = {
  dismiss: 'Dismiss this report',
  uphold: 'Uphold this report',
  suspend: 'Uphold and suspend the author',
  lift: 'Lift the author’s suspension',
};

@Component({
  selector: 'app-flagged-moments-panel',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="flagged-title">
      <h3 id="flagged-title">Flagged Moments</h3>
      <p>
        Moments that members have flagged, newest first. The text shown is the snapshot taken when
        the Moment was flagged. Every decision is recorded in the audit trail with your account,
        the reason code and the outcome.
      </p>

      <label class="status-filter">Show
        <select
          name="status"
          [ngModel]="status()"
          (ngModelChange)="changeStatus($event)"
          [disabled]="busy()"
        >
          @for (option of statusOptions; track option) {
            <option [value]="option">{{ statusLabel(option) }}</option>
          }
        </select>
      </label>

      <p class="summary" role="status" aria-live="polite">
        @if (busy() && !loaded()) {
          Loading flagged Moments…
        } @else if (loaded() && !error()) {
          {{ total() }} flagged {{ total() === 1 ? 'Moment' : 'Moments' }}.
        }
      </p>
      <p class="feedback" role="status" aria-live="polite">{{ feedback() }}</p>
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      @for (item of items(); track item.reportId) {
        <article class="card" [attr.aria-labelledby]="'flag-title-' + item.reportId">
          <header>
            <h4 [id]="'flag-title-' + item.reportId">{{ item.reasonCategory }}</h4>
            <p>{{ statusLabel(item.status) }} · flagged {{ formatDate(item.createdAt) }}</p>
          </header>

          <blockquote dir="auto">
            @if (item.moment.excerpt) {
              {{ item.moment.excerpt }}
            } @else {
              <em>This Moment has no text.</em>
            }
          </blockquote>
          @if (!item.moment.available) {
            <p>The author has since deleted this Moment. The text above is the snapshot kept for review.</p>
          }
          @if (item.moment.mediaUrls.length > 0) {
            <ul class="media" aria-label="Attached media">
              @for (url of item.moment.mediaUrls; track url; let index = $index) {
                <li>
                  <a [href]="url" target="_blank" rel="noopener noreferrer">
                    Open media {{ index + 1 }} (new tab)
                  </a>
                </li>
              }
            </ul>
          }

          <dl>
            <div>
              <dt>Author</dt>
              <dd>
                <a [routerLink]="['/users', item.author.id]">
                  {{ item.author.displayName || item.author.id }}
                </a>
              </dd>
            </div>
            <div>
              <dt>Flagged by</dt>
              <dd>{{ item.reporter.displayName || item.reporter.id || 'System / unavailable' }}</dd>
            </div>
            @if (item.moment.targetLanguage) {
              <div><dt>Language</dt><dd>{{ item.moment.targetLanguage }}</dd></div>
            }
            @if (item.moment.postType) {
              <div><dt>Post type</dt><dd>{{ item.moment.postType }}</dd></div>
            }
          </dl>
          @if (item.reportDescription) {
            <p class="description"><strong>Reporter’s note:</strong> {{ item.reportDescription }}</p>
          }

          @if (item.author.activeSuspension; as suspension) {
            <p class="suspended" role="note">
              <strong>Author suspended</strong> until {{ formatDate(suspension.expiresAt) }}.
            </p>
          }

          @if (canManage()) {
            <div class="actions">
              @if (item.status === 'pending') {
                <button type="button" (click)="open(item, 'dismiss')" [disabled]="busy()">
                  Dismiss report
                </button>
                <button type="button" (click)="open(item, 'uphold')" [disabled]="busy()">
                  Uphold report
                </button>
              }
              @if (!item.author.activeSuspension) {
                <button type="button" (click)="open(item, 'suspend')" [disabled]="busy()">
                  Uphold and suspend author…
                </button>
              } @else {
                <button type="button" (click)="open(item, 'lift')" [disabled]="busy()">
                  Lift suspension…
                </button>
              }
            </div>
          }

          @if (review(); as active) {
            @if (active.reportId === item.reportId) {
              <form
                class="confirm"
                [id]="'review-' + item.reportId"
                tabindex="-1"
                role="group"
                [attr.aria-labelledby]="'review-title-' + item.reportId"
                (ngSubmit)="confirm(item)"
              >
                <h5 [id]="'review-title-' + item.reportId">{{ actionTitle(active.action) }}</h5>
                <p class="consequence">{{ consequence(active.action, item) }}</p>

                @if (active.action === 'suspend') {
                  <label>Suspension length
                    <select name="duration" [(ngModel)]="durationDays" [disabled]="busy()">
                      @for (days of durations; track days) {
                        <option [ngValue]="days">{{ days }} {{ days === 1 ? 'day' : 'days' }}</option>
                      }
                    </select>
                  </label>
                }
                <label>Reason
                  <select name="reason" [(ngModel)]="reasonCode" [disabled]="busy()">
                    @for (reason of reasons; track reason.code) {
                      <option [value]="reason.code">{{ reason.label }}</option>
                    }
                  </select>
                </label>
                <label>Private note (optional, audit trail only)
                  <textarea
                    name="note"
                    rows="3"
                    maxlength="1000"
                    [(ngModel)]="operatorNote"
                    [disabled]="busy()"
                  ></textarea>
                </label>

                @if (reviewError()) {
                  <p role="alert">{{ reviewError() }}</p>
                }
                <div class="actions">
                  <button type="submit" [disabled]="busy()">
                    {{ busy() ? 'Working…' : 'Confirm: ' + actionTitle(active.action).toLowerCase() }}
                  </button>
                  <button type="button" (click)="cancel()" [disabled]="busy()">Cancel</button>
                </div>
              </form>
            }
          }
        </article>
      } @empty {
        @if (loaded() && !busy() && !error()) {
          <p>No flagged Moments match this filter.</p>
        }
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="Flagged Moment pages">
          <button type="button" (click)="previousPage()" [disabled]="busy() || page() <= 1">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button type="button" (click)="nextPage()" [disabled]="busy() || page() >= totalPages()">Next</button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .status-filter { display: grid; gap: .35rem; max-inline-size: 22rem; }
    .card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; margin-block-start: 1rem; overflow-wrap: anywhere; }
    .card h4 { margin: 0; }
    blockquote { margin-inline: 0; padding-inline-start: .75rem; border-inline-start: .25rem solid currentColor; white-space: pre-wrap; }
    .media { padding-inline-start: 1.25rem; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
    dl div { display: grid; gap: .2rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .suspended { border: 2px solid currentColor; padding: .5rem .75rem; border-radius: .5rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-block-start: .75rem; }
    .actions button, .pagination button { min-block-size: 2.75rem; padding-inline: 1rem; }
    .confirm { display: grid; gap: .75rem; margin-block-start: 1rem; padding: 1rem; border: 2px dashed currentColor; border-radius: .5rem; max-inline-size: 36rem; }
    .confirm label { display: grid; gap: .35rem; }
    .confirm h5 { margin: 0; }
    .consequence { margin: 0; font-weight: 600; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-block-start: 1rem; }
  `],
})
export class FlaggedMomentsPanelComponent {
  private readonly api = inject(AdminFlaggedMomentsService);
  private readonly auth = inject(AdminAuthContextService);
  private readonly injector = inject(Injector);

  readonly pageSize = 10;
  readonly reasons = MODERATION_REASONS;
  readonly durations = [1, 7, 30, 90];
  readonly statusOptions: FlaggedMomentStatus[] = ['pending', 'approved', 'rejected'];

  readonly status = signal<FlaggedMomentStatus>('pending');
  readonly items = signal<FlaggedMomentItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly review = signal<ActiveReview | null>(null);
  readonly reviewError = signal<string | null>(null);
  readonly canManage = computed(() => this.auth.hasCapability('moderation.cases.manage'));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  reasonCode: ModerationReasonCode = 'policy_violation';
  operatorNote = '';
  durationDays = 7;
  private lastAttempt: { signature: string; key: string } | null = null;

  constructor() {
    void this.load(true);
  }

  statusLabel(status: FlaggedMomentStatus): string {
    return STATUS_LABELS[status];
  }

  actionTitle(action: ReviewAction): string {
    return ACTION_TITLES[action];
  }

  consequence(action: ReviewAction, item: FlaggedMomentItem): string {
    const author = item.author.displayName || 'The author';
    switch (action) {
      case 'dismiss':
        return 'The report is closed as no violation. The Moment stays visible and the author is not contacted.';
      case 'uphold':
        return 'The report is closed as a confirmed violation. This records the decision only: it does not remove the Moment or restrict the author.';
      case 'suspend':
        return `${author} will be blocked from the app until ${this.formatDate(
          new Date(Date.now() + this.durationDays * DAY_MS).toISOString(),
        )}. They see only when it ends. You can lift it at any time, and the report is upheld.`;
      case 'lift':
        return `${author} regains access within about 30 seconds.`;
    }
  }

  async load(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    await this.loadItems();
  }

  async changeStatus(value: FlaggedMomentStatus): Promise<void> {
    this.status.set(value);
    this.cancel();
    await this.load(true);
  }

  open(item: FlaggedMomentItem, action: ReviewAction): void {
    if (this.busy() || !this.canManage()) return;
    this.review.set({ reportId: item.reportId, action });
    this.reviewError.set(null);
    this.feedback.set(null);
    this.reasonCode = action === 'dismiss' ? 'other_reviewed' : 'policy_violation';
    this.operatorNote = '';
    this.durationDays = 7;
    afterNextRender(
      () => document.getElementById(`review-${item.reportId}`)?.focus(),
      { injector: this.injector },
    );
  }

  cancel(): void {
    this.review.set(null);
    this.reviewError.set(null);
  }

  async confirm(item: FlaggedMomentItem): Promise<void> {
    const active = this.review();
    if (!active || active.reportId !== item.reportId || this.busy() || !this.canManage()) return;

    this.busy.set(true);
    this.reviewError.set(null);
    try {
      this.feedback.set(await this.perform(active.action, item));
      this.review.set(null);
      this.lastAttempt = null;
      await this.loadItems();
    } catch (error) {
      this.reviewError.set(
        error instanceof ModerationActionError
          ? error.message
          : 'The moderation service is unavailable. Try again shortly.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  previousPage(): void {
    if (this.page() <= 1 || this.busy()) return;
    this.page.update((value) => value - 1);
    void this.loadItems();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages() || this.busy()) return;
    this.page.update((value) => value + 1);
    void this.loadItems();
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleString();
  }

  private async perform(action: ReviewAction, item: FlaggedMomentItem): Promise<string> {
    const operatorNote = this.operatorNote.trim() || undefined;
    const reasonCode = this.reasonCode;

    switch (action) {
      case 'dismiss':
      case 'uphold': {
        const result = await firstValueFrom(
          this.api.resolve(item.reportId, { decision: action, reasonCode, operatorNote }),
        );
        const verb = action === 'dismiss' ? 'dismissed' : 'upheld';
        return result.replayed ? `Report was already ${verb}.` : `Report ${verb}.`;
      }
      case 'suspend': {
        const result = await firstValueFrom(
          this.api.suspend(item.author.id, {
            expiresAt: new Date(Date.now() + this.durationDays * DAY_MS).toISOString(),
            reasonCode,
            operatorNote,
            reportId: item.reportId,
            idempotencyKey: this.keyFor(item, reasonCode, operatorNote),
          }),
        );
        return `Author suspended until ${this.formatDate(result.expiresAt)}.`;
      }
      case 'lift': {
        const suspension = item.author.activeSuspension;
        if (!suspension) return 'The author is not suspended.';
        const result = await firstValueFrom(
          this.api.lift(suspension.id, { reasonCode, operatorNote }),
        );
        return result.replayed ? 'Suspension was already lifted.' : 'Suspension lifted.';
      }
    }
  }

  /**
   * One key per distinct request: retrying after a failure reuses it, so the
   * backend cannot issue a second suspension, while changing the length, reason
   * or note starts a new request.
   */
  private keyFor(item: FlaggedMomentItem, reasonCode: string, note: string | undefined): string {
    const signature = [item.author.id, item.reportId, this.durationDays, reasonCode, note ?? ''].join('|');
    if (this.lastAttempt?.signature !== signature) {
      this.lastAttempt = { signature, key: crypto.randomUUID() };
    }
    return this.lastAttempt.key;
  }

  private async loadItems(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.api.list({ page: this.page(), pageSize: this.pageSize, status: this.status() }),
      );
      this.items.set(result.items);
      this.total.set(result.total);
      this.page.set(result.page);
    } catch (error) {
      this.items.set([]);
      this.total.set(0);
      this.error.set(
        error instanceof ModerationActionError
          ? error.message
          : 'The moderation service is unavailable. Try again shortly.',
      );
    } finally {
      this.loaded.set(true);
      this.busy.set(false);
    }
  }
}
