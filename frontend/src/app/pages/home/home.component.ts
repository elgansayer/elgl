import { Component, inject } from '@angular/core';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  template: `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="p-4 border-b border-gray-700 flex items-center justify-between">
        <h1 class="text-xl font-bold">HelloTalk</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">
            {{ authService.currentUser()?.email }}
          </span>
        </div>
      </header>

      <main class="p-4">
        <p class="text-gray-300">Welcome to the home page.</p>
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
