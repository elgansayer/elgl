import { Component, inject, signal, computed } from '@angular/core';
import { TranslatePipe } from '../../../services/translate.pipe';
import { NotificationPreferencesService } from '../../../services/notification-preferences.service';

@Component({
  standalone: true,
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.component.html',
  imports: [TranslatePipe],
})
export class NotificationSettingsComponent {
  private readonly prefsService = inject(NotificationPreferencesService);

  readonly customToneUrl = signal('');
  readonly vibrationPatternText = signal('');
  readonly saved = signal(false);

  readonly saveAvailable = computed(
    () =>
      this.customToneUrl().trim().length > 0 ||
      this.vibrationPatternText().trim().length > 0,
  );

  onToneInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.customToneUrl.set(target.value);
    }
  }

  onVibrationInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.vibrationPatternText.set(target.value);
    }
  }

  async savePreferences(): Promise<void> {
    const toneUrl = this.customToneUrl().trim() || undefined;
    const vibrationPattern = this.vibrationPatternText()
      .trim()
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);

    await this.prefsService.updateCustomizationPreferences(
      toneUrl,
      vibrationPattern.length ? vibrationPattern : undefined,
    );
    this.saved.set(true);
  }
}
