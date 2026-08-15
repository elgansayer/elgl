import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminOperationalEvent, AdminOperationalEventsService } from '../admin-operational-events.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="logs-title">
      <p class="eyebrow">Operations</p>
      <h2 id="logs-title">Operational events</h2>
      <p>
        Sanitized structured events authorized by <code>logs.read</code>. Raw process logs,
        stack traces, request bodies and secrets are intentionally unavailable.
      </p>

      <form class="filters" (ngSubmit)="load(true)">
        <label>Severity
          <select name="severity" [(ngModel)]="severity" [disabled]="busy()">
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </label>
        <label>Category
          <input name="category" [(ngModel)]="category" maxlength="80" [disabled]="busy()" />
        </label>
        <label>Source
          <input name="source" [(ngModel)]="source" maxlength="80" [disabled]="busy()" />
        </label>
        <label>Correlation ID
          <input name="correlationId" [(ngModel)]="correlationId" maxlength="128" [disabled]="busy()" />
        </label>
        <label>From
          <input type="datetime-local" name="startTime" [(ngModel)]="startTime" [disabled]="busy()" />
        </label>
        <label>Until
          <input type="datetime-local" name="endTime" [(ngModel)]="endTime" [disabled]="busy()" />
        </label>
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Loading…' : 'Apply filters' }}</button>
      </form>

      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (loaded() && !error()) {
        <p aria-live="polite">{{ total() }} matching events. Page {{ page() }}.</p>
      }

      @if (events().length > 0) {
        <div class="events" aria-label="Operational events">
          @for (event of events(); track event.id) {
            <article class="event-card">
              <header>
                <h3>{{ event.category }}</h3>
                <p><strong>{{ event.severity }}</strong> · {{ formatDate(event.created_at) }}</p>
              </header>
              <p>{{ event.message }}</p>
              <dl>
                <div><dt>Source</dt><dd>{{ event.source || 'Not specified' }}</dd></div>
                <div><dt>Correlation ID</dt><dd><code>{{ event.correlation_id || 'None' }}</code></dd></div>
              </dl>
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No operational events matched these filters.</p>
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="Operational event pages">
          <button type="button" (click)="previousPage()" [disabled]="busy() || page() <= 1">Previous</button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button type="button" (click)="nextPage()" [disabled]="busy() || page() >= totalPages()">Next</button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; align-items: end; }
    label { display: grid; gap: .35rem; }
    .events { display: grid; gap: 1rem; margin-top: 1rem; }
    .event-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .event-card h3 { margin: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
    dl div { display: grid; gap: .2rem; } dt { font-weight: 700; } dd { margin: 0; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
  `],
})
export class LogsPageComponent {
  private readonly service = inject(AdminOperationalEventsService);
  readonly pageSize = 25;
  severity = '';
  category = '';
  source = '';
  correlationId = '';
  startTime = '';
  endTime = '';
  readonly events = signal<AdminOperationalEvent[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() { void this.load(true); }

  totalPages(): number { return Math.max(1, Math.ceil(this.total() / this.pageSize)); }

  async load(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(this.service.list({
        page: this.page(), pageSize: this.pageSize,
        severity: this.severity || undefined,
        category: this.category,
        source: this.source,
        correlationId: this.correlationId,
        startTime: this.toIso(this.startTime),
        endTime: this.toIso(this.endTime),
      }));
      this.events.set(result.events);
      this.total.set(result.total);
      this.page.set(result.page);
      this.loaded.set(true);
    } catch (error) {
      this.events.set([]); this.total.set(0); this.loaded.set(true);
      this.error.set(error instanceof Error ? error.message : 'Operational event lookup failed');
    } finally { this.busy.set(false); }
  }

  previousPage(): void { if (this.page() > 1 && !this.busy()) { this.page.update(v => v - 1); void this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages() && !this.busy()) { this.page.update(v => v + 1); void this.load(); } }
  formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString(); }
  private toIso(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
