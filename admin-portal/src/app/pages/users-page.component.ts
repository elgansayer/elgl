import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminUserDataFailure,
  AdminUserSummary,
  AdminUsersService,
  failureOf,
} from '../admin-users.service';

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEARCH_FAILURE_MESSAGES: Record<AdminUserDataFailure, string> = {
  unavailable: 'User search is temporarily unavailable. Try again.',
  unauthenticated: 'Your admin session has expired. Sign in again to continue.',
  forbidden: 'Your admin account is not permitted to search users.',
  'not-found': 'User search is temporarily unavailable. Try again.',
};

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

      <form class="search-form id-lookup" (ngSubmit)="openUserById()" aria-labelledby="id-lookup-title">
        <h3 id="id-lookup-title">Open a user by ID</h3>
        <label for="user-id-lookup">User ID</label>
        <div class="search-row">
          <input
            id="user-id-lookup"
            name="userId"
            type="text"
            autocomplete="off"
            spellcheck="false"
            maxlength="36"
            [(ngModel)]="userIdQuery"
            [attr.aria-invalid]="idError() ? 'true' : null"
            [attr.aria-describedby]="idError() ? 'user-id-lookup-error' : null"
          />
          <button type="submit">Open user</button>
        </div>
        @if (idError()) {
          <p id="user-id-lookup-error" class="field-error" role="alert">{{ idError() }}</p>
        }
      </form>

      @if (error()) {
        <div class="status-message error-state" role="alert">
          <p>{{ error() }}</p>
          @switch (failure()) {
            @case ('unauthenticated') {
              <a routerLink="/login">Sign in again</a>
            }
            @case ('forbidden') {
              <a routerLink="/">Return to the admin overview</a>
            }
            @default {
              <button type="button" (click)="retrySearch()" [disabled]="busy()">
                {{ busy() ? 'Retrying…' : 'Retry search' }}
              </button>
            }
          }
        </div>
      }

      <p class="status-message" role="status">
        @if (!error() && loaded()) {
          {{ total() }} matching {{ total() === 1 ? 'user' : 'users' }}.
          Page {{ page() }}.
        }
      </p>

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
    .id-lookup { margin-block-start: 1.5rem; }
    .id-lookup h3 { margin: 0; }
    .field-error { margin: 0; font-weight: 700; }
    .status-message { margin-block: 1rem; }
    .status-message:empty { margin-block: 0; }
    .error-state { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .error-state p { margin: 0; }
    .results { display: grid; gap: 1rem; margin-top: 1rem; }
    .user-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .user-card h3 { margin: 0; }
    .user-id { font-family: ui-monospace, monospace; font-size: .9em; }
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
  private readonly router = inject(Router);
  private requestGeneration = 0;
  readonly pageSize = 20;
  query = '';
  readonly userIdQuery = signal('');
  readonly idError = signal<string | null>(null);
  readonly users = signal<AdminUserSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly failure = signal<AdminUserDataFailure | null>(null);

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
    this.failure.set(null);
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
    } catch (error) {
      if (requestGeneration !== this.requestGeneration) return;
      const failure = failureOf(error);
      this.users.set([]);
      this.total.set(0);
      this.loaded.set(true);
      this.failure.set(failure);
      this.error.set(SEARCH_FAILURE_MESSAGES[failure]);
    } finally {
      if (requestGeneration === this.requestGeneration) {
        this.busy.set(false);
      }
    }
  }

  async openUserById(): Promise<void> {
    const userId = this.userIdQuery().trim().toLowerCase();
    if (!USER_ID_PATTERN.test(userId)) {
      this.idError.set('Enter a valid user ID in the 8-4-4-4-12 hexadecimal format.');
      return;
    }
    this.idError.set(null);
    await this.router.navigate(['/users', userId]);
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
