import { Component, inject } from '@angular/core';

import { AuthService } from '../../services/auth.service';
import { StudyStreakWidgetComponent } from '../../components/study-streak-widget/study-streak-widget.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-home',
  imports: [StudyStreakWidgetComponent, TranslatePipe],
  template: `
    <div class="min-h-screen bg-[#121212] text-white">
      <header class="py-4 ps-4 pe-4 border-b border-gray-700 flex items-center justify-between">
        <h1 class="text-xl font-bold">{{ 'home.title' | t }}</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">
            {{ authService.currentUser()?.email }}
          </span>
        </div>
      </header>

      <main class="py-4 ps-4 pe-4 space-y-4">
        <app-study-streak-widget></app-study-streak-widget>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class HomeComponent {
  readonly authService = inject(AuthService);
}
