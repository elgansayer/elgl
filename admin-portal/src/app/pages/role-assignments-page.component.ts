import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminRoleAssignmentSummary,
  AdminRolesService,
} from '../admin-roles.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="assignments-title">
      <p><a routerLink="/roles">← Back to roles</a></p>
      <p class="eyebrow">Access control</p>
      <h2 id="assignments-title">Operator role assignments</h2>
      <p>
        Read-only assignment inventory authorized by <code>roles.read</code>. No grant, revoke or privilege-elevation controls are available here.
      </p>

      <form class="filters" (ngSubmit)="load(true)">
        <label>User ID <input name="userId" [(ngModel)]="userId" maxlength="128" /></label>
        <label>Role key <input name="roleKey" [(ngModel)]="roleKey" maxlength="80" /></label>
        <label>Granted by <input name="grantedBy" [(ngModel)]="grantedBy" maxlength="128" placeholder="Exact administrator ID" /></label>
        <div class="actions">
          <button type="submit" [disabled]="busy()">Apply filters</button>
          <button type="button" (click)="clearFilters()" [disabled]="busy()">Clear</button>
        </div>
      </form>

      @if (busy()) { <p aria-live="polite">Loading assignments…</p> }
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (!busy() && !error() && loaded()) {
        <p aria-live="polite">{{ total() }} matching {{ total() === 1 ? 'assignment' : 'assignments' }}.</p>
      }

      @if (assignments().length > 0) {
        <div class="assignments" aria-label="Administrative role assignments">
          @for (assignment of assignments(); track assignment.userId + ':' + assignment.roleId) {
            <article class="assignment-card">
              <h3>{{ assignment.roleName }}</h3>
              <p><code>{{ assignment.roleKey }}</code> · {{ assignment.active ? 'Active' : 'Expired' }}</p>
              <dl>
                <div><dt>User ID</dt><dd>{{ assignment.userId }}</dd></div>
                <div><dt>Granted by</dt><dd>{{ assignment.grantedBy || 'Bootstrap/system' }}</dd></div>
                <div><dt>Granted</dt><dd>{{ formatDate(assignment.grantedAt) }}</dd></div>
                <div><dt>Expires</dt><dd>{{ assignment.expiresAt ? formatDate(assignment.expiresAt) : 'No expiry' }}</dd></div>
              </dl>
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No role assignments matched the current filters.</p>
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="Role assignment pages">
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
    .assignments { display: grid; gap: 1rem; margin-top: 1rem; }
    .assignment-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .assignment-card h3 { margin: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; }
    dl div { display: grid; gap: .2rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
  `],
})
export class RoleAssignmentsPageComponent {
  private readonly roles = inject(AdminRolesService);
  readonly pageSize = 50;
  userId = '';
  roleKey = '';
  grantedBy = '';
  readonly assignments = signal<AdminRoleAssignmentSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() { void this.load(true); }

  async load(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.roles.listAssignments(
          this.page(),
          this.pageSize,
          this.userId,
          this.roleKey,
          this.grantedBy,
        ),
      );
      this.assignments.set(result.assignments);
      this.total.set(result.total);
      this.page.set(result.page);
      this.loaded.set(true);
    } catch (error) {
      this.assignments.set([]);
      this.total.set(0);
      this.loaded.set(true);
      this.error.set(error instanceof Error ? error.message : 'Role assignment lookup failed');
    } finally {
      this.busy.set(false);
    }
  }

  clearFilters(): void {
    this.userId = '';
    this.roleKey = '';
    this.grantedBy = '';
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

  totalPages(): number { return Math.max(1, Math.ceil(this.total() / this.pageSize)); }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }
}
