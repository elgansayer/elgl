import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthContextService } from '../admin-auth-context.service';
import { AdminLoginService } from '../admin-login.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="admin-login-title">
      <p class="eyebrow">Privileged authentication</p>
      <h2 id="admin-login-title">Admin sign in</h2>
      <p>Authentication is verified again by the backend before any admin capability is granted.</p>

      <form (ngSubmit)="submit()">
        <label>
          Email
          <input name="email" type="email" autocomplete="username" required [(ngModel)]="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" required [(ngModel)]="password" />
        </label>
        <button type="submit" [disabled]="busy()">{{ busy() ? 'Verifying…' : 'Sign in' }}</button>
      </form>

      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <p class="security-note">The portal does not persist the access token in localStorage or sessionStorage.</p>
    </section>
  `,
})
export class LoginPageComponent {
  private readonly login = inject(AdminLoginService);
  private readonly context = inject(AdminAuthContextService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.login.signIn(this.email, this.password);
      await firstValueFrom(this.context.load());
      this.password = '';
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.login.signOut();
      this.context.clear();
      this.password = '';
      this.error.set(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      this.busy.set(false);
    }
  }
}
