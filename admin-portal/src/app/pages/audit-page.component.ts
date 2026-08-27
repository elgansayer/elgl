import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminAuditEventSummary,
  AdminAuditService,
} from '../admin-audit.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="audit-title">
      <p class="eyebrow">Audit</p>
      <h2 id="audit-title">Administrative audit events</h2>
      <p>
        Newest-first, bounded audit history. Access requires <code>audit.read</code>.
        Private operator notes are not included in this view.
      </p>

      <form class="filters" (ngSubmit)="load(true)">
        <label>Action <input name="action" [(ngModel)]="action" /></label>
        <label>Outcome
          <select name="outcome" [(ngModel)]="outcome">
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>Capability <input name="capabilityKey" [(ngModel)]="capabilityKey" /></label>
        <label>Reason code <input name="reasonCode" [(ngModel)]="reasonCode" /></label>
        <label>Actor user ID <input name="actor" [(ngModel)]="actorUserId" /></label>
        <label>Target type <input name="targetType" [(ngModel)]="targetType" /></label>
        <label>Target ID <input name="targetId" [(ngModel)]="targetId" /></label>
        <label>Correlation ID <input name="correlation" [(ngModel)]="correlationId" /></label>
        <label>From <input type="datetime-local" name="startTime" [(ngModel)]="startTime" /></label>
        <label>Until <input type="datetime-local" name="endTime" [(ngModel)]="endTime" /></label>
        <div class="actions">
          <button type="submit" [disabled]="busy()">Apply filters</button>
          <button type="button" (click)="clearFilters()" [disabled]="busy()">Clear</button>
        </div>
      </form>

      @if (busy()) {
        <p aria-live="polite">Loading audit events…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      @if (!busy() && !error() && loaded()) {
        <p aria-live="polite">{{ total() }} matching audit {{ total() === 1 ? 'event' : 'events' }}.</p>
      }

      @if (events().length > 0) {
        <div class="events" aria-label="Administrative audit events">
          @for (event of events(); track event.id) {
            <article class="event-card">
              <header>
                <h3>{{ event.action }}</h3>
                <p>{{ formatDate(event.created_at) }} · {{ event.outcome }}</p>
              </header>
              <dl>
                <div><dt>Actor</dt><dd>{{ event.actor_user_id }}</dd></div>
                <div><dt>Capability</dt><dd>{{ event.capability_key || 'None recorded' }}</dd></div>
                <div><dt>Target</dt><dd>{{ formatTarget(event) }}</dd></div>
                <div><dt>Reason</dt><dd>{{ event.reason_code || 'None recorded' }}</dd></div>
                <div><dt>Correlation</dt><dd>{{ event.correlation_id }}</dd></div>
              </dl>
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No audit events matched the current filters.</p>
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="Audit event pages">
          <button type="button" (click)="previousPage()" [disabled]="busy() || page() <= 1">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button type="button" (click)="nextPage()" [disabled]="busy() || page() >= totalPages()">Next</button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; align-items: end; }
    .filters label { display: grid; gap: .25rem; font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    .events { display: grid; gap: 1rem; margin-top: 1rem; }
    .event-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .event-card h3 { margin: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
    dl div { display: grid; gap: .2rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
  `],
})
export class AuditPageComponent {
  private readonly audit = inject(AdminAuditService);
  readonly pageSize = 50;
  action = '';
  outcome: '' | 'success' | 'denied' | 'failed' = '';
  capabilityKey = '';
  reasonCode = '';
  actorUserId = '';
  targetType = '';
  targetId = '';
  correlationId = '';
  startTime = '';
  endTime = '';
  readonly events = signal<AdminAuditEventSummary[]>([]);
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
      const result = await firstValueFrom(this.audit.list({
        page: this.page(),
        pageSize: this.pageSize,
        action: this.action,
        outcome: this.outcome || undefined,
        capabilityKey: this.capabilityKey,
        reasonCode: this.reasonCode,
        actorUserId: this.actorUserId,
        targetType: this.targetType,
        targetId: this.targetId,
        correlationId: this.correlationId,
        startTime: this.toIso(this.startTime),
        endTime: this.toIso(this.endTime),
      }));
      this.events.set(result.events);
      this.total.set(result.total);
      this.page.set(result.page);
      this.loaded.set(true);
    } catch (error) {
      this.events.set([]);
      this.total.set(0);
      this.loaded.set(true);
      this.error.set(error instanceof Error ? error.message : 'Audit lookup failed');
    } finally {
      this.busy.set(false);
    }
  }

  clearFilters(): void {
    this.action = '';
    this.outcome = '';
    this.capabilityKey = '';
    this.reasonCode = '';
    this.actorUserId = '';
    this.targetType = '';
    this.targetId = '';
    this.correlationId = '';
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

  formatTarget(event: AdminAuditEventSummary): string {
    if (!event.target_type && !event.target_id) return 'None recorded';
    return [event.target_type, event.target_id].filter(Boolean).join(': ');
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
