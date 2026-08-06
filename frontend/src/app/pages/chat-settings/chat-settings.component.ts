import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { rxResource } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-chat-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './chat-settings.component.html',
})
export class ChatSettingsComponent {
  private settingsService = inject(ChatSettingsService);

  readonly autoTranslate = this.settingsService.autoTranslate;
  readonly readReceipts = this.settingsService.readReceipts;
  readonly enterToSend = this.settingsService.enterToSend;
  readonly loaded = this.settingsService.loaded;

  settingsResource = rxResource({
    loader: () => this.settingsService.loadSettings(),
  });

  toggleAutoTranslate(): void {
    this.settingsService.updateSetting('autoTranslate', !this.autoTranslate());
  }

  toggleReadReceipts(): void {
    this.settingsService.updateSetting('readReceipts', !this.readReceipts());
  }

  toggleEnterToSend(): void {
    this.settingsService.updateSetting('enterToSend', !this.enterToSend());
  }
}
