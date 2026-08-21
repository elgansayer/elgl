import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminSystemHealthSnapshot,
  AdminSystemService,
} from '../admin-system.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="system-health-title">
      <p class="eyebrow">System</p>
      <h2 id="system-health-title">System health</h2>
      <p>
        Bounded operational health authorized by <code>system.health.read</code>.
        This view intentionally omits hostnames, credentials, connection strings and raw errors.
      </p>

      <button type="button" (click)="load()" [disabled]="busy()">
        {{ busy() ? 'Refreshing…' : 'Refresh health' }}
      </button>

      @if (busy() && !snapshot()) {
        <p aria-live="polite">Loading system health…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      @if (snapshot(); as health) {
        <div class="summary" aria-live="polite">
          <h3>Overall: {{ health.state }}</h3>
          <p>Checked {{ formatDate(health.checkedAt) }}</p>
        </div>

        <dl class="dependencies">
          <div>
            <dt>Database</dt>
            <dd>{{ health.dependencies.database }}</dd>
            <dd>{{ health.dependencyLatencyMs.database }} ms</dd>
          </div>
          <div>
            <dt>Redis</dt>
            <dd>{{ health.dependencies.redis }}</dd>
            <dd>{{ health.dependencyLatencyMs.redis }} ms</dd>
          </div>
        </dl>

        @if (health.state === 'degraded') {
          <p class="degraded-message" role="status">
            One or more core dependencies are degraded. Detailed infrastructure information is intentionally not exposed in this view.
          </p>
        }
      }
    </section>
  `,
  styles: [`
    .summary, .dependencies, .degraded-message { margin-top: 1rem; }
    .summary { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
    .summary h3 { margin-block-start: 0; text-transform: capitalize; }
    .dependencies { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; }
    .dependencies div { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
    dt { font-weight: 700; }
    dd { margin: .25rem 0 0; text-transform: capitalize; }
    .degraded-message { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
  `],
})
export class SystemHealthPageComponent {
  private readonly system = inject(AdminSystemService);
  readonly snapshot = signal<AdminSystemHealthSnapshot | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.snapshot.set(await firstValueFrom(this.system.getHealth()));
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'System health lookup failed',
      );
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }
}
