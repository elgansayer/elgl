import { Injectable, signal, inject, EnvironmentInjector, ApplicationRef, createComponent, ComponentRef } from '@angular/core';
import { APP_VERSION, MIN_SUPPORTED_VERSION } from '../version.constants';
import { UpdateModalComponent } from '../components/update-modal/update-modal.component';

/**
 * Checks whether the installed app version is deprecated and
 * exposes a reactive signal that can be used to show a blocking modal.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  /** True when the current app version is below the minimum supported version */
  readonly isDeprecated = signal(false);

  private environmentInjector = inject(EnvironmentInjector);
  private appRef = inject(ApplicationRef);

  private modalRef?: ComponentRef<UpdateModalComponent> = undefined;

  /** Parse and compare version strings */
  private isVersionLower(installed: string, minimum: string): boolean {
    const toParts = (v: string) => v.split('.').map(Number);
    const i = toParts(installed);
    const m = toParts(minimum);
    for (let p = 0; p < 3; p++) {
      const iv = i[p] || 0;
      const mv = m[p] || 0;
      if (iv !== mv) {
        return iv < mv;
      }
    }
    return false; // equal versions are not deprecated
  }

  /**
   * Runs the version comparison, updates the `isDeprecated` signal,
   * and displays a blocking modal if the app is deprecated.
   * @returns true if the app is deprecated
   */
  async checkVersion(): Promise<boolean> {
    const deprecated = this.isVersionLower(APP_VERSION, MIN_SUPPORTED_VERSION);
    this.isDeprecated.set(deprecated);
    if (deprecated) {
      this.showBlockingModal();
    }
    return deprecated;
  }

  /**
   * Opens a full‑screen modal that prevents any interaction with the app.
   * The only action available is to trigger a full page reload in order to
   * obtain the newest deployed version.
   */
  private showBlockingModal(): void {
    if (this.modalRef) {
      return; // already visible
    }

    const hostElement = document.createElement('div');
    const componentRef = createComponent(UpdateModalComponent, {
      environmentInjector: this.environmentInjector,
      hostElement,
    });

    componentRef.setInput(
      'message',
      'A new version is available. Please update the app to continue.'
    );

    document.body.appendChild(hostElement);
    this.appRef.attachView(componentRef.hostView);

    // The modal is not dismissible; the only interaction leads to a full reload.
    this.modalRef = componentRef;
  }
}
