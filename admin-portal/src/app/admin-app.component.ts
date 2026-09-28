import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthContextService } from './admin-auth-context.service';

@Component({
  selector: 'admin-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#admin-main">Skip to main content</a>
    <div class="shell">
      <aside class="sidebar" aria-label="Admin navigation">
        <div class="brand">
          <strong>ELGL Admin</strong>
          <span>Privileged operations</span>
        </div>
        <nav>
          @if (has('users.read')) {
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Overview</a>
            <a routerLink="/users" routerLinkActive="active">Users</a>
          }
          @if (has('moderation.cases.read')) {
            <a routerLink="/moderation" routerLinkActive="active">Moderation</a>
          }
          @if (has('security.network.read')) {
            <a routerLink="/network-security" routerLinkActive="active">Network Security</a>
          }
          @if (has('roles.read')) {
            <a routerLink="/roles" routerLinkActive="active">Roles & Permissions</a>
          }
          @if (has('audit.read')) {
            <a routerLink="/audit" routerLinkActive="active">Audit</a>
          }
          @if (has('logs.read')) {
            <a routerLink="/logs" routerLinkActive="active">Logs</a>
          }
          @if (has('system.health.read')) {
            <a routerLink="/system" routerLinkActive="active">System</a>
          }
        </nav>
        <div class="security-note" role="note">
          Backend authorization is authoritative. Hidden navigation never grants or removes access.
        </div>
      </aside>
      <main id="admin-main" tabindex="-1">
        <header class="topbar">
          <div>
            <p class="eyebrow">Dedicated admin origin</p>
            <h1>Operations Console</h1>
          </div>
          <div class="session-state" aria-label="Admin session status">Secure session required</div>
        </header>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminAppComponent {
  private readonly authContext = inject(AdminAuthContextService);

  has(capability: string): boolean {
    return this.authContext.hasCapability(capability);
  }
}
