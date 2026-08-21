import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminModerationReport,
  AdminModerationService,
} from '../admin-moderation.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="moderation-title">
      <p class="eyebrow">Moderation</p>
      <h2 id="moderation-title">Report triage queue</h2>
      <p>
        Read-only moderation reports authorized by
        <code>moderation.cases.read</code>. Enforcement actions are intentionally not
        available in this stage.
      </p>

      <form class="filters" (ngSubmit)="load(true)">
        <label>Report ID
          <input
            name="reportId"
            [(ngModel)]="reportId"
            maxlength="128"
            placeholder="Exact report ID"
            [disabled]="busy()"
          />
        </label>
        <label>Status
          <input
            name="status"
            [(ngModel)]="status"
            maxlength="40"
            placeholder="e.g. open"
            [disabled]="busy()"
          />
        </label>
        <label>Reason category
          <input
            name="reasonCategory"
            [(ngModel)]="reasonCategory"
            maxlength="80"
            placeholder="e.g. harassment"
            [disabled]="busy()"
          />
        </label>
        <label>Reported user ID
          <input
            name="reportedUserId"
            [(ngModel)]="reportedUserId"
            maxlength="128"
            placeholder="Exact user ID"
            [disabled]="busy()"
          />
        </label>
        <label>Reporter user ID
          <input
            name="reporterUserId"
            [(ngModel)]="reporterUserId"
            maxlength="128"
            placeholder="Exact reporter ID"
            [disabled]="busy()"
          />
        </label>
        <label>From
          <input type="datetime-local" name="startTime" [(ngModel)]="startTime" [disabled]="busy()" />
        </label>
        <label>Until
          <input type="datetime-local" name="endTime" [(ngModel)]="endTime" [disabled]="busy()" />
        </label>
        <div class="filter-row">
          <button type="submit" [disabled]="busy()">Apply</button>
          <button type="button" (click)="clearFilters()" [disabled]="busy()">Clear</button>
        </div>
      </form>

      @if (busy()) {
        <p aria-live="polite">Loading moderation reports…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (!busy() && !error() && loaded()) {
        <p aria-live="polite">
          {{ total() }} matching {{ total() === 1 ? 'report' : 'reports' }}.
        </p>
      }

      @if (reports().length > 0) {
        <div class="reports" aria-label="Moderation report queue">
          @for (report of reports(); track report.id) {
            <article class="report-card">
              <header>
                <h3>{{ report.reason_category }}</h3>
                <p>{{ report.status }} · {{ formatDate(report.created_at) }}</p>
              </header>
              <dl>
                <div><dt>Report ID</dt><dd><code>{{ report.id }}</code></dd></div>
                <div>
                  <dt>Reported user</dt>
                  <dd>
                    <a [routerLink]="['/users', report.reported_user_id]">
                      {{ report.reported_name || report.reported_user_id }}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Reporter</dt>
                  <dd>
                    @if (report.reporter_id) {
                      <a [routerLink]="['/users', report.reporter_id]">
                        {{ report.reporter_name || report.reporter_id }}
                      </a>
                    } @else {
                      System / unavailable
                    }
                  </dd>
                </div>
              </dl>
              @if (report.description) {
                <div class="description">
                  <h4>Description</h4>
                  <p>{{ report.description }}</p>
                </div>
              }
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No moderation reports matched the current filters.</p>
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="Moderation report pages">
          <button type="button" (click)="previousPage()" [disabled]="busy() || page() <= 1">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button type="button" (click)="nextPage()" [disabled]="busy() || page() >= totalPages()">Next</button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .5rem; max-width: 56rem; align-items: end; }
    .filters label { display: grid; gap: .35rem; }
    .filter-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .reports { display: grid; gap: 1rem; margin-top: 1rem; }
    .report-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .report-card h3 { margin: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
    dl div { display: grid; gap: .2rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .description { border-block-start: 1px solid currentColor; padding-block-start: .75rem; }
    .description h4 { margin-block: 0 .4rem; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
  `],
})
export class ModerationPageComponent {
  private readonly moderation = inject(AdminModerationService);
  readonly pageSize = 20;
  reportId = '';
  status = '';
  reasonCategory = '';
  reportedUserId = '';
  reporterUserId = '';
  startTime = '';
  endTime = '';
  readonly reports = signal<AdminModerationReport[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.load(true);
  }

  async load(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.moderation.listReports(
          this.page(),
          this.pageSize,
          this.reportId,
          this.status,
          this.reasonCategory,
          this.reportedUserId,
          this.reporterUserId,
          this.toIso(this.startTime),
          this.toIso(this.endTime),
        ),
      );
      this.reports.set(result.reports);
      this.total.set(result.total);
      this.page.set(result.page);
      this.loaded.set(true);
    } catch (error) {
      this.reports.set([]);
      this.total.set(0);
      this.loaded.set(true);
      this.error.set(
        error instanceof Error ? error.message : 'Moderation queue lookup failed',
      );
    } finally {
      this.busy.set(false);
    }
  }

  clearFilters(): void {
    this.reportId = '';
    this.status = '';
    this.reasonCategory = '';
    this.reportedUserId = '';
    this.reporterUserId = '';
    this.startTime = '';
    this.endTime = '';
    void this.load(true);
  }

  previousPage(): void {
    if (this.page() <= 1 || this.busy()) return;
    this.page.update((value) => value - 1);
    void this.load();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages() || this.busy()) return;
    this.page.update((value) => value + 1);
    void this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  private toIso(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
