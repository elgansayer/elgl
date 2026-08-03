import { Component, inject, signal } from '@angular/core';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-notification-customization',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './notification-customization.component.html',
})
export class NotificationCustomizationComponent {
  private readonly prefsService = inject(NotificationPreferencesService);

  readonly customToneUrl = signal('');
  readonly vibrationPattern = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);

  constructor() {
    void this.loadPreferences();
  }

  private async loadPreferences(): Promise<void> {
    try {
      const prefs = await this.prefsService.getCustomizationPreferences();
      this.customToneUrl.set(prefs.customToneUrl ?? '');
      this.vibrationPattern.set((prefs.vibrationPattern ?? []).join(','));
    } catch {
      this.error.set('Failed to load notification customisation');
    } finally {
      this.loading.set(false);
    }
  }

  onToneChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.customToneUrl.set(input?.value ?? '');
  }

  onVibrationChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.vibrationPattern.set(input?.value ?? '');
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set('');

    const pattern = this.vibrationPattern()
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));

    try {
      await this.prefsService.updateCustomizationPreferences(
        this.customToneUrl() || undefined,
        pattern,
      );
      this.saved.set(true);
    } catch {
      this.error.set('Failed to save notification customisation');
    } finally {
      this.saving.set(false);
    }
  }
}
