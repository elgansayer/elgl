import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminRoleInventoryEntry,
  AdminRolesService,
} from '../admin-roles.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="roles-title">
      <p class="eyebrow">Access control</p>
      <h2 id="roles-title">Roles & permissions</h2>
      <p>
        Read-only role inventory authorized by <code>roles.read</code>. Role assignment and privilege mutation are intentionally unavailable here.
      </p>

      <p><a routerLink="/roles/assignments">View operator role assignments</a></p>

      <button type="button" (click)="load()" [disabled]="busy()">
        {{ busy() ? 'Refreshing…' : 'Refresh roles' }}
      </button>

      @if (busy() && !loaded()) {
        <p aria-live="polite">Loading roles…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      @if (roles().length > 0) {
        <div class="roles" aria-label="Administrative roles">
          @for (role of roles(); track role.id) {
            <article class="role-card">
              <header>
                <h3>{{ role.name }}</h3>
                <p><code>{{ role.key }}</code>{{ role.is_system ? ' · System role' : '' }}</p>
              </header>
              @if (role.description) {
                <p>{{ role.description }}</p>
              }
              <h4>Capabilities</h4>
              @if (role.capabilities.length > 0) {
                <ul>
                  @for (capability of role.capabilities; track capability) {
                    <li><code>{{ capability }}</code></li>
                  }
                </ul>
              } @else {
                <p>No capabilities assigned.</p>
              }
            </article>
          }
        </div>
      } @else if (loaded() && !busy() && !error()) {
        <p>No administrative roles were returned.</p>
      }
    </section>
  `,
  styles: [`
    .roles { display: grid; gap: 1rem; margin-top: 1rem; }
    .role-card { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; overflow-wrap: anywhere; }
    .role-card h3 { margin: 0; }
    .role-card h4 { margin-bottom: .5rem; }
    ul { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0; list-style: none; }
    li { border: 1px solid currentColor; border-radius: .5rem; padding: .35rem .5rem; }
  `],
})
export class RolesPageComponent {
  private readonly rolesService = inject(AdminRolesService);
  readonly roles = signal<AdminRoleInventoryEntry[]>([]);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.roles.set(await firstValueFrom(this.rolesService.list()));
      this.loaded.set(true);
    } catch (error) {
      this.roles.set([]);
      this.loaded.set(true);
      this.error.set(error instanceof Error ? error.message : 'Role inventory lookup failed');
    } finally {
      this.busy.set(false);
    }
  }
}
