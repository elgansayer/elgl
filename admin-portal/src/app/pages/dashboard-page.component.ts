import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" aria-labelledby="dashboard-title">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Admin platform</p>
          <h2 id="dashboard-title">Operational overview</h2>
          <p>Start investigations and operational work from a dedicated privileged surface.</p>
        </div>
      </div>

      <div class="notice" role="status">
        This foundation intentionally contains no mock privileged data. Each card will activate only when the admin API and capability checks are wired.
      </div>

      <div class="card-grid">
        <a class="card" routerLink="/users"><strong>User operations</strong><span>Search accounts, review status and manage reversible restrictions.</span><code>users.read</code></a>
        <a class="card" routerLink="/moderation"><strong>Trust & safety</strong><span>Review reports, evidence, queues, appeals and enforcement state.</span><code>moderation.cases.read</code></a>
        <a class="card" routerLink="/audit"><strong>Audit history</strong><span>Inspect privileged reads, mutations, approvals and reasons.</span><code>audit.read</code></a>
        <a class="card" routerLink="/logs"><strong>Operational logs</strong><span>Search sanitized structured logs and correlation traces.</span><code>logs.read</code></a>
        <a class="card" routerLink="/system"><strong>System health</strong><span>Inspect queues, dependencies, caches, storage and service health.</span><code>system.health.read</code></a>
      </div>
    </section>
  `,
})
export class DashboardPageComponent {}
