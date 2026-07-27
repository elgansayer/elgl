import { Component, inject, effect, OnDestroy } from '@angular/core';
import { SystemMessageService } from '../../services/system-message.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  standalone: false,
  selector: 'app-system-bubble',
  templateUrl: './system-bubble.component.html',
  styleUrls: ['./system-bubble.component.scss'],
})
export class SystemBubbleComponent implements OnDestroy {
  private readonly systemMessage = inject(SystemMessageService);
  private readonly i18n = inject(I18nService);

  readonly bubbles = this.systemMessage.bubbles;
  readonly latest = this.bubbles.asReadonly; // will be used in template via bubbles()

  // optional translation helper (calling i18n.translate)
  translate(key?: string, params?: Record<string, any>): string {
    if (!key) return '';
    return this.i18n.translate(key, params ?? {});
  }

  private dismissTimer: any = null;

  constructor() {
    // auto‑dismiss the newest bubble after 8 seconds
    effect((onCleanup) => {
      const current = this.bubbles();
      if (current.length > 0) {
        this.dismissTimer = setTimeout(
          () => this.systemMessage.dismiss(current[current.length - 1].id),
          8000,
        );
        onCleanup(() => clearTimeout(this.dismissTimer));
      }
    });
  }

  dismiss(id: number): void {
    this.systemMessage.dismiss(id);
  }

  ngOnDestroy(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
  }
}
