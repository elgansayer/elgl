import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AppLockService } from '../../services/app-lock.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-device-lock',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="flex h-full items-center justify-center bg-surface-900 text-white">
      <div class="max-w-sm text-center">
        <h1 class="mb-6 text-2xl font-bold">{{ 'deviceLock.title' | t }}</h1>
        <p class="mb-8 text-white/60">{{ 'deviceLock.message' | t }}</p>
        <button
          hlmBtn
          type="button"
          size="touch"
          [disabled]="unlocking()"
          [attr.aria-busy]="unlocking() ? 'true' : null"
          (click)="unlock()"
        >
          {{ 'deviceLock.unlock' | t }}
        </button>
      </div>
    </div>
  `,
})
export class DeviceLockComponent {
  private readonly appLockService = inject(AppLockService);
  private readonly router = inject(Router);

  readonly unlocking = signal(false);

  async unlock(): Promise<void> {
    if (this.unlocking()) return;

    this.unlocking.set(true);
    try {
      const success = await this.appLockService.unlock();
      if (success) {
        await this.router.navigate(['/home']);
      }
    } finally {
      this.unlocking.set(false);
    }
  }
}
