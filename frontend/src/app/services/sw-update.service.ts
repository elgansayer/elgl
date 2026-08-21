import { Injectable, inject, ApplicationRef, signal, DestroyRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Manages Angular Service Worker lifecycle events, including update
 * detection and activation. Exposes a reactive signal indicating
 * whether a new app version is available for activation.
 */
@Injectable({ providedIn: 'root' })
export class SwUpdateService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);
  private destroyRef = inject(DestroyRef);

  readonly updateAvailable = signal(false);
  readonly updateActivated = signal(false);

  /**
   * Checks for available updates and subscribes to version-ready events.
   * Should be called once during app initialisation in the browser.
   */
  initialise(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evt) => {
        this.updateAvailable.set(true);
        console.warn('New app version available:', evt.latestVersion);
      });

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evt) => {
        console.error('Unrecoverable SW state:', evt.reason);
        document.location.reload();
      });

    this.checkForUpdate();
  }

  /**
   * Manually checks for a new version on the server.
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate.isEnabled) {
      return false;
    }
    try {
      const updateFound = await this.swUpdate.checkForUpdate();
      if (updateFound) {
        this.updateAvailable.set(true);
      }
      return updateFound;
    } catch {
      return false;
    }
  }

  /**
   * Activates the downloaded update and reloads the application.
   * The reload is deferred until the app is stable to avoid
   * interrupting ongoing requests.
   */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return;
    }
    try {
      await this.swUpdate.activateUpdate();
      this.updateActivated.set(true);
      // Wait for the app to stabilise, then reload
      const appStable = await firstValueFrom(this.appRef.isStable);
      if (appStable) {
        document.location.reload();
      }
    } catch {
      // Activation failed; the user can try again
    }
  }
}