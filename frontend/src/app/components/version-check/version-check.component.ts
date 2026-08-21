import { Component, inject, signal, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { VersionService, VersionInfo } from '../../services/version.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-version-check',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="p-4">
      <h2>{{ 'appVersion' | t }}</h2>
      @if (versionError()) {
        <p class="text-danger">{{ versionError() }}</p>
      }
      @if (!versionLoaded()) {
        <p>{{ 'loading' | t }}</p>
      } @else {
        <p>{{ 'currentVersion' | t }}: {{ version().current }}</p>
        <p>{{ 'latestVersion' | t }}: {{ version().latest }}</p>
        @if (updateAvailable()) {
          <p class="text-success">{{ 'updateAvailable' | t }}</p>
          @if (version().updateUrl) {
            <a hlmBtn [href]="version().updateUrl" target="_blank" rel="noopener noreferrer" size="touch">
              {{ 'downloadUpdate' | t }}
            </a>
          }
        } @else {
          <p>{{ 'upToDate' | t }}</p>
        }
        <button hlmBtn type="button" variant="secondary" size="touch" (click)="checkUpdate()">
          {{ 'checkForUpdates' | t }}
        </button>
      }
    </div>
  `,
})
export class VersionCheckComponent implements OnInit {
  private versionService = inject(VersionService);

  readonly version = signal<VersionInfo>({ current: '', latest: '' });
  readonly versionLoaded = signal(false);
  readonly versionError = signal('');
  readonly updateAvailable = signal(false);

  async ngOnInit(): Promise<void> {
    await this.checkUpdate();
  }

  async checkUpdate(): Promise<void> {
    try {
      const version = await firstValueFrom(this.versionService.getVersion());
      this.version.set(version);
      this.versionLoaded.set(true);
      this.updateAvailable.set(version.current !== version.latest);
    } catch {
      this.versionError.set('Failed to fetch version');
    }
  }
}
