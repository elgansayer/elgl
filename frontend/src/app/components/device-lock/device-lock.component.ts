import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppLockService } from '../../services/app-lock.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-device-lock',
  imports: [TranslatePipe],
  template: `
    <div class="flex h-full items-center justify-center bg-surface-500 text-text-primary">
      <div class="max-w-sm text-center">
        <h1 class="mb-6 text-2xl font-bold">{{ 'deviceLock.title' | t }}</h1>
        <p class="mb-8 text-text-secondary">{{ 'deviceLock.message' | t }}</p>
        <button
          type="button"
          (click)="unlock()"
          class="rounded-full bg-primary px-6 py-3 text-on-fill transition hover:bg-primary-dark"
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

  async unlock(): Promise<void> {
    const success = await this.appLockService.unlock();
    if (success) {
      await this.router.navigate(['/home']);
    }
  }
}
