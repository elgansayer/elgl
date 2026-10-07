import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { AppLockService } from '../../services/app-lock.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-device-lock',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div
      class="flex min-h-full items-center justify-center bg-surface-500 p-4 text-text-primary sm:p-6"
    >
      <div class="w-full max-w-sm text-center">
        <h1 class="mb-4 break-words text-2xl font-bold text-text-primary sm:text-3xl" dir="auto">
          {{ 'deviceLock.title' | t }}
        </h1>
        <p
          id="device-lock-status"
          class="mb-8 break-words text-sm leading-relaxed text-text-secondary sm:text-base"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          dir="auto"
        >
          {{ (unlockFailed() ? 'common.error_generic' : 'deviceLock.message') | t }}
        </p>
        <button
          hlmBtn
          type="button"
          size="touch"
          class="w-full max-w-full whitespace-normal break-words sm:w-auto"
          aria-describedby="device-lock-status"
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
  readonly unlockFailed = signal(false);

  async unlock(): Promise<void> {
    if (this.unlocking()) return;

    this.unlockFailed.set(false);
    this.unlocking.set(true);
    try {
      const success = await this.appLockService.unlock();
      if (success) {
        await this.router.navigate(['/home']);
        return;
      }

      this.unlockFailed.set(true);
    } catch {
      this.unlockFailed.set(true);
    } finally {
      this.unlocking.set(false);
    }
  }
}
