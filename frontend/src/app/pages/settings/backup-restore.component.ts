import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ChatBackupService } from '../../services/chat-backup.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { environment } from '../../../environments/environment';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface BackupRoom {
  id: string;
  title?: string;
  subtitle?: string;
  avatar?: string | null;
  is_online?: boolean;
  is_pinned?: boolean;
}

function isBackupRoom(value: unknown): value is BackupRoom {
  if (!isRecord(value)) return false;
  return typeof value['id'] === 'string';
}

function isBackupRoomArray(value: unknown): value is BackupRoom[] {
  return Array.isArray(value) && value.every(isBackupRoom);
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

@Component({
  selector: 'app-backup-restore',
  imports: [HlmNativeSelect, HlmButton, TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-500 text-text-primary ps-4 pe-4 pt-6 pb-10">
      <h1 class="text-2xl font-bold mb-1">{{ 'backupRestore.title' | t }}</h1>
      <p class="text-text-secondary mb-6">{{ 'backupRestore.subtitle' | t }}</p>

      @if (roomsResource.isLoading()) {
        <p class="text-text-secondary">{{ 'common.loading' | t }}</p>
      } @else if (rooms().length) {
        <label for="roomSelect" class="block mb-2 text-sm font-medium text-text-secondary">
          {{ 'backupRestore.selectRoom' | t }}
          <hlm-native-select
            selectId="roomSelect"
            class="w-full mb-4 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2 text-text-primary"
            selectClass="w-full mb-4 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2 text-text-primary"
            [value]="selectedRoom()"
            (change)="onRoomChange($event)"
          >
            @for (room of rooms(); track room.id) {
              <option [value]="room.id">{{ room.title ?? room.id }}</option>
            }
          </hlm-native-select>
        </label>
      } @else {
        <p class="text-text-secondary">{{ 'chatList.empty' | t }}</p>
      }

      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          hlmBtn
          type="button"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 disabled:opacity-50"
          [disabled]="!selectedRoom()"
          (click)="exportChat()"
        >
          {{ 'backupRestore.exportBtn' | t }}
        </button>

        <label
          for="importFile"
          class="inline-flex cursor-pointer items-center rounded-lg border border-surface-300 px-4 py-2 text-sm text-text-secondary hover:bg-surface-100"
        >
          {{ 'backupRestore.importBtn' | t }}
          <input
            id="importFile"
            type="file"
            accept="application/json"
            class="hidden"
            (change)="onFileSelected($event)"
          />
        </label>

        <button
          hlmBtn
          type="button"
          class="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-on-fill hover:bg-success/90 disabled:opacity-50"
          [disabled]="!selectedRoom() || !importFile()"
          (click)="importChat()"
        >
          {{ 'backupRestore.importBtn' | t }}
        </button>
      </div>

      @if (statusMessage()) {
        <p class="mt-4 text-sm text-success">{{ statusMessage() }}</p>
      }
    </div>
  `,
})
export class BackupRestoreComponent {
  private readonly http = inject(HttpClient);
  private readonly backupService = inject(ChatBackupService);
  private readonly i18n = inject(I18nService);
  private readonly apiBase = environment.apiUrl ?? '/api';

  readonly selectedRoom = signal('');
  readonly importFile = signal<File | null>(null);
  readonly statusMessage = signal('');

  readonly roomsResource = resource({
    loader: async (): Promise<BackupRoom[]> => {
      try {
        const rooms = await firstValueFrom(this.http.get<unknown>(`${environment.apiUrl}/chat/rooms`));
        if (isBackupRoomArray(rooms)) {
          return rooms;
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  readonly rooms = computed(() => this.roomsResource.value() ?? []);

  onRoomChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.selectedRoom.set(target.value);
    }
  }

  async exportChat(): Promise<void> {
    const roomId = this.selectedRoom();
    if (!roomId) return;
    try {
      const buffer = await this.backupService.exportChannel(roomId);
      const blob = new Blob([buffer], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-backup-${roomId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.statusMessage.set(this.i18n.translate('backupRestore.exportSuccess'));
    } catch {
      this.statusMessage.set(this.i18n.translate('backupRestore.exportError'));
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      const file = target.files?.[0];
      if (file) this.importFile.set(file);
    }
  }

  async importChat(): Promise<void> {
    const roomId = this.selectedRoom();
    const file = this.importFile();
    if (!roomId || !file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed) || !('messages' in parsed)) {
        throw new Error('Invalid backup format');
      }
      const messages = parsed['messages'];
      if (!isRecordArray(messages)) {
        throw new Error('Invalid backup format');
      }
      const messagesForImport: Record<string, unknown>[] = messages;
      const count = await this.backupService.importChannel(roomId, messagesForImport);
      this.statusMessage.set(
        this.i18n.translate('backupRestore.importSuccess', { count: count.toString() }),
      );
    } catch {
      this.statusMessage.set(this.i18n.translate('backupRestore.importError'));
    }
  }
}
