import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminUserSummary, AdminUsersService } from '../admin-users.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="users-title">
      <p class="eyebrow">Users</p>
      <h2 id="users-title">User search</h2>
      <p>
        Search bounded administrative user metadata. Results are authorized by the
        backend <code>users.read</code> capability.
      </p>

      <form class="search-form" (ngSubmit)="searchUsers(true)" role="search">
        <label for="user-search">Display name</label>
        <div class="search-row">
          <input
            id="user-search"
            name="search"
            type="search"
            autocomplete="off"
            maxlength="120"
            [(ngModel)]="query"
            [disabled]="busy()"
          />
          <button type="submit" [disabled]="busy()">
            {{ busy() ? 'Searching…' : 'Search' }}
          </button>
        </div>
      </form>

      @if (error()) {
        <div class="status-message error-state" role="alert">
          <p>{{ error() }}</p>
          <button type="button" (click)="retrySearch()" [disabled]="busy()">
            {{ busy() ? 'Retrying…' : 'Retry search' }}
          </button>
        </div>
      }

      @if (!error() && loaded()) {
        <p class="status-message" aria-live="polite">
          {{ total() }} matching {{ total() === 1 ? 'user' : 'users' }}.
          Page {{ page() }}.
        </p>
      }

      @if (users().length > 0) {
        <div class="results" aria-label="User search results">
          @for (user of users(); track user.id) {
            <article class="user-card">
              <div>
                <h3>
                  <a [routerLink]="['/users', user.id]">
                    {{ user.display_name || 'Unnamed user' }}
                  </a>
                </h3>
                <p class="user-id"><span class="visually-hidden">User ID: </span>{{ user.id }}</p>
              </div>
              <dl>
                <div>
                  <dt>VIP</dt>
                  <dd>{{ user.is_vip ? (user.vip_tier || 'Yes') : 'No' }}</dd>
                </div>
                <div>
                  <dt>Study streak</dt>
                  <dd>{{ user.study_streak_days ?? 0 }} days</dd>
                </div>
                <div>
                  <dt>Last active</dt>
                  <dd>{{ formatDate(user.last_active_at) }}</dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{{ formatDate(user.created_at) }}</dd>
                </div>
              </dl>
              <p class="inspect-link"><a [routerLink]="['/users', user.id]">Inspect user</a></p>
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No users matched this search.</p>
      }

      @if (loaded() && total() > pageSize) {
        <nav class="pagination" aria-label="User search pages">
          <button type="button" (click)="previousPage()" [disabled]="busy() || page() <= 1">
            Previous
          </button>
          <span>Page {{ page() }} of {{ totalPages() }}</span>
          <button
            type="button"
            (click)="nextPage()"
            [disabled]="busy() || page() >= totalPages()"
          >
            Next
          </button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .search-form { display: grid; gap: .5rem; max-width: 48rem; }
    .search-row { display: flex; gap: .75rem; align-items: stretch; }
    .search-row input { flex: 1 1 20rem; min-width: 0; }
    .status-message { margin-block: 1rem; }
    .error-state { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .error-state p { margin: 0; }
    .results { display: grid; gap: 1rem; margin-top: 1rem; }
    .user-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .user-card h3 { margin: 0; }
    .user-id { font-family: ui-monospace, monospace; font-size: .9em; }
    .inspect-link { margin-bottom: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .75rem; margin-bottom: 0; }
    dl div { display: grid; gap: .2rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .pagination { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-top: 1rem; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 36rem) { .search-row { flex-direction: column; } }
  `],
})
export class UsersPageComponent {
  private readonly usersService = inject(AdminUsersService);
  private requestGeneration = 0;
  readonly pageSize = 20;
  query = '';
  readonly users = signal<AdminUserSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.searchUsers(true);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  async searchUsers(resetPage = false): Promise<void> {
    if (resetPage) this.page.set(1);
    const requestGeneration = ++this.requestGeneration;
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.usersService.search({
          page: this.page(),
          pageSize: this.pageSize,
          search: this.query,
        }),
      );
      if (requestGeneration !== this.requestGeneration) return;
      this.users.set(result.users);
      this.total.set(result.total);
      this.page.set(result.page);
      this.loaded.set(true);
    } catch {
      if (requestGeneration !== this.requestGeneration) return;
      this.users.set([]);
      this.total.set(0);
      this.loaded.set(true);
      this.error.set('User search is temporarily unavailable. Try again.');
    } finally {
      if (requestGeneration === this.requestGeneration) {
        this.busy.set(false);
      }
    }
  }

  retrySearch(): void {
    if (this.busy()) return;
    void this.searchUsers();
  }

  previousPage(): void {
    if (this.page() <= 1 || this.busy()) return;
    this.page.update((value) => value - 1);
    void this.searchUsers();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages() || this.busy()) return;
    this.page.update((value) => value + 1);
    void this.searchUsers();
  }

  formatDate(value: string | null): string {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }
}
