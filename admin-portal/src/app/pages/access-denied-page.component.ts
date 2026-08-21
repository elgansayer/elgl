import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="access-denied-title">
      <p class="eyebrow">Authorization required</p>
      <h2 id="access-denied-title">Access denied</h2>
      <p>
        Your current admin session does not have the capability required for this area,
        or the server could not verify the privileged session.
      </p>
      <p><a routerLink="/">Return to the admin overview</a></p>
    </section>
  `,
})
export class AccessDeniedPageComponent {}
