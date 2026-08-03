import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppLockService } from '../../services/app-lock.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-device-lock',
  imports: [TranslatePipe],
  template: `
    <div class="flex h-full items-center justify-center bg-neutral-900 text-white">
      <div class="max-w-sm text-center">
        <h1 class="mb-6 text-2xl font-bold">{{ 'deviceLock.title' | t }}</h1>
        <p class="mb-8 text-neutral-400">{{ 'deviceLock.message' | t }}</p>
        <button
          type="button"
          (click)="unlock()"
          class="rounded-full bg-primary-500 px-6 py-3 text-white transition hover:bg-primary-600"
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
