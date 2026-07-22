import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioRoomsStore } from '../../services/audio-rooms.store';

@Component({
  selector: 'app-room-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col h-96 overflow-hidden"
    >
      <div
        class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between"
      >
        <span
          class="font-black text-xs text-slate-800 flex items-center gap-1.5"
        >
          <span>💬 Synchronised room chat and subtitles</span>
        </span>
        <button
          (click)="activeTab.set(activeTab() === 'chat' ? 'subtitles' : 'chat')"
          [class]="
            'px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-colors ' +
            (activeTab() === 'subtitles'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-200 text-slate-700')
          "
        >
          {{
            activeTab() === 'subtitles'
              ? '💬 Show chat'
              : '🎙️ Show AI subtitles (' + store.captions().length + ')'
          }}
        </button>
      </div>

      <div class="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
        @if (activeTab() === 'chat') {
          @if (store.roomMessages().length === 0) {
            <div class="text-center py-12 text-slate-400">
              No messages in this live room yet. Say hello to the stage speakers!
            </div>
          }
          @for (msg of store.roomMessages(); track msg.id) {
            <div class="p-2 rounded-xl bg-slate-50">
              <div
                class="flex items-center justify-between font-bold text-[11px] text-slate-600 mb-0.5"
              >
                <span>{{ msg.sender_name }}</span>
                <span class="text-[9px] text-slate-400">{{
                  msg.created_at | date: 'shortTime'
                }}</span>
              </div>
              <p class="text-slate-800">{{ msg.text_content }}</p>
            </div>
          }
        }

        @if (activeTab() === 'subtitles') {
          @if (store.captions().length === 0) {
            <div class="text-center py-12 text-slate-400">
              No live subtitles yet. When speakers talk on stage or use speech-to-text, closed
              captions broadcast here!
            </div>
          }
          @for (cap of store.captions(); track cap.id) {
            <div
              class="p-2.5 rounded-xl bg-purple-50 border border-purple-200"
            >
              <span class="font-bold text-[10px] text-purple-900 block mb-1"
                >🎙️ {{ cap.speaker_name }} (Live AI caption):</span
              >
              <p class="text-xs font-medium text-slate-900">
                {{ cap.text_content }}
              </p>
            </div>
          }
        }
      </div>

      @if (activeTab() === 'chat') {
        <div
          class="p-3 bg-slate-50 border-t border-slate-200 flex gap-2"
        >
          <input
            type="text"
            [(ngModel)]="inputText"
            (keyup.enter)="send()"
            placeholder="Send a chat message to the room..."
            class="flex-1 px-3 py-1.5 border rounded-xl bg-white text-xs focus:ring-2 focus:ring-primary"
          />
          <button
            (click)="send()"
            class="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow"
          >
            Send
          </button>
        </div>
      }

      @if (activeTab() === 'subtitles' && store.isSpeaker()) {
        <div
          class="p-3 bg-purple-50 border-t border-purple-200 flex gap-2"
        >
          <input
            type="text"
            [(ngModel)]="inputCaption"
            (keyup.enter)="sendSubtitle()"
            placeholder="Simulate speech-to-text live subtitle broadcast..."
            class="flex-1 px-3 py-1.5 border rounded-xl bg-white text-xs focus:ring-2 focus:ring-purple-600"
          />
          <button
            (click)="sendSubtitle()"
            class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow"
          >
            Broadcast caption
          </button>
        </div>
      }
    </div>
  `,
})
export class RoomChatComponent {
  readonly store = inject(AudioRoomsStore);
  readonly activeTab = signal<'chat' | 'subtitles'>('chat');

  inputText = '';
  inputCaption = '';

  async send(): Promise<void> {
    if (!this.inputText.trim()) return;
    await this.store.sendRoomChatMessage(this.inputText);
    this.inputText = '';
  }

  async sendSubtitle(): Promise<void> {
    if (!this.inputCaption.trim()) return;
    await this.store.sendCaption(this.inputCaption);
    this.inputCaption = '';
  }
}
