import { Component, input, inject, signal } from '@angular/core';
import { ChatBackupService } from '../../services/chat-backup.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-backup',
  imports: [TranslatePipe],
  template: `
    <div class="flex flex-col gap-4 p-4">
      <h2 class="text-lg font-bold">{{ 'chat_backup.title' | t }}</h2>

      @if (exporting()) {
        <p class="text-primary">{{ 'chat_backup.exporting' | t }}</p>
      }

      @if (importing()) {
        <p class="text-primary">{{ 'chat_backup.importing' | t }}</p>
      }

      <button
        class="app-button-primary ps-4 pe-4 pt-2.5 pb-2.5 text-sm"
        (click)="onExport()"
        [disabled]="exporting()"
      >
        {{ 'chat_backup.export_button' | t }}
      </button>

      <input
        type="file"
        #fileInput
        accept=".json"
        style="display: none"
        (change)="onFileSelected($event)"
      />
      <button
        class="app-button-secondary ps-4 pe-4 pt-2.5 pb-2.5 text-sm"
        (click)="fileInput.click()"
        [disabled]="importing()"
      >
        {{ 'chat_backup.import_button' | t }}
      </button>

      @if (exportError()) {
        <p class="text-danger">{{ 'chat_backup.export_error' | t }}</p>
      }
      @if (importError()) {
        <p class="text-danger">{{ 'chat_backup.import_error' | t }}</p>
      }
    </div>
  `,
})
export class ChatBackupComponent {
  readonly channelId = input.required<string>();

  private readonly backupService = inject(ChatBackupService);

  protected readonly exporting = signal(false);
  protected readonly importing = signal(false);
  protected readonly exportError = signal(false);
  protected readonly importError = signal(false);

  async onExport(): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(false);
    try {
      const arrayBuffer = await this.backupService.exportChannel(this.channelId());
      const blob = new Blob([arrayBuffer], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-backup-${this.channelId()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.exportError.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const input = target;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const rawResult = reader.result;
        if (typeof rawResult !== 'string') {
          this.importError.set(true);
          return;
        }
        const messages = JSON.parse(rawResult);
        if (!Array.isArray(messages)) {
          this.importError.set(true);
          return;
        }
        this.importing.set(true);
        await this.backupService.importChannel(this.channelId(), messages);
      } catch {
        this.importError.set(true);
      } finally {
        this.importing.set(false);
        input.value = '';
      }
    };

    reader.readAsText(file);
  }
}
