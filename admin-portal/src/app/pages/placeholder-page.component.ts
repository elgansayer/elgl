import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <p class="eyebrow">Admin module</p>
      <h2>{{ title }}</h2>
      <p>This module is reserved for the dedicated admin API and must not fall back to mock privileged data.</p>
      <div class="notice" role="note">
        Required backend capability: <code>{{ capability }}</code>
      </div>
    </section>
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = String(this.route.snapshot.data['title'] ?? 'Admin module');
  readonly capability = String(this.route.snapshot.data['capability'] ?? 'admin.unknown');
}
