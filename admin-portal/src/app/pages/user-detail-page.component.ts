import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminUserSummary, AdminUsersService } from '../admin-users.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="user-detail-title">
      <p><a routerLink="/users">← Back to user search</a></p>
      <p class="eyebrow">Users</p>
      <h2 id="user-detail-title">User investigation</h2>
      <p>
        This view contains bounded operational metadata authorized by
        <code>users.read</code>. It does not expose credentials, tokens or unrestricted
        private profile data.
      </p>

      @if (busy()) {
        <p aria-live="polite">Loading user…</p>
      }

      @if (error()) {
        <div role="alert" class="error-panel">
          <h3>Unable to load user</h3>
          <p>{{ error() }}</p>
          <p><a routerLink="/users">Return to user search</a></p>
        </div>
      }

      @if (user(); as currentUser) {
        <article class="detail-card">
          <header>
            <h3>{{ currentUser.display_name || 'Unnamed user' }}</h3>
            <p class="user-id"><span class="visually-hidden">User ID: </span>{{ currentUser.id }}</p>
          </header>

          <dl>
            <div>
              <dt>VIP status</dt>
              <dd>{{ currentUser.is_vip ? (currentUser.vip_tier || 'VIP') : 'Not VIP' }}</dd>
            </div>
            <div>
              <dt>Admin flag</dt>
              <dd>{{ currentUser.is_admin ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>Coin balance</dt>
              <dd>{{ currentUser.coins_balance ?? 0 }}</dd>
            </div>
            <div>
              <dt>Study streak</dt>
              <dd>{{ currentUser.study_streak_days ?? 0 }} days</dd>
            </div>
            <div>
              <dt>Native languages</dt>
              <dd>{{ formatLanguages(currentUser.native_languages) }}</dd>
            </div>
            <div>
              <dt>Target languages</dt>
              <dd>{{ formatLanguages(currentUser.target_languages) }}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>{{ formatDate(currentUser.last_active_at) }}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{{ formatDate(currentUser.created_at) }}</dd>
            </div>
          </dl>
        </article>
      }
    </section>
  `,
  styles: [`
    .detail-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .detail-card h3 { margin-block-start: 0; }
    .user-id { font-family: ui-monospace, monospace; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; }
    dl div { display: grid; gap: .25rem; }
    dt { font-weight: 700; }
    dd { margin: 0; }
    .error-panel { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  `],
})
export class UserDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(AdminUsersService);
  readonly user = signal<AdminUserSummary | null>(null);
  readonly busy = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.loadUser();
  }

  private async loadUser(): Promise<void> {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId) {
      this.error.set('No user identifier was provided.');
      this.busy.set(false);
      return;
    }

    try {
      this.user.set(await firstValueFrom(this.usersService.getUser(userId)));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'User lookup failed');
    } finally {
      this.busy.set(false);
    }
  }

  formatDate(value: string | null): string {
    if (!value) return 'Unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  formatLanguages(languages: string[] | null): string {
    return languages?.length ? languages.join(', ') : 'None recorded';
  }
}
