import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioRoomsStore } from '../../services/audio-rooms.store';

@Component({
  selector: 'app-room-chat',
  imports: [HlmInput, HlmButton, CommonModule, FormsModule],
  template: `
    <div
      class="bg-surface-200 rounded-3xl shadow-xl border border-surface-100 flex flex-col h-96 overflow-hidden"
    >
      <div
        class="bg-surface-300 px-4 py-3 border-b border-surface-100 flex items-center justify-between"
      >
        <span class="font-black text-xs text-text-primary flex items-center gap-1.5">
          <span>💬 Synchronised room chat and subtitles</span>
        </span>
        <button
          hlmBtn
          (click)="activeTab.set(activeTab() === 'chat' ? 'subtitles' : 'chat')"
          [class]="
            'px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-colors ' +
            (activeTab() === 'subtitles'
              ? 'bg-secondary text-on-fill'
              : 'bg-surface-100 text-text-primary')
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
            <div class="text-center py-12 text-text-muted">
              No messages in this live room yet. Say hello to the stage speakers!
            </div>
          }
          @for (msg of store.roomMessages(); track msg.id) {
            <div class="p-2 rounded-xl bg-surface-300">
              <div
                class="flex items-center justify-between font-bold text-[11px] text-text-secondary mb-0.5"
              >
                <span>{{ msg.sender_name }}</span>
                <span class="text-[9px] text-text-muted">{{
                  msg.created_at | date: 'shortTime'
                }}</span>
              </div>
              <p class="text-text-primary">{{ msg.text_content }}</p>
            </div>
          }
        }

        @if (activeTab() === 'subtitles') {
          @if (store.captions().length === 0) {
            <div class="text-center py-12 text-text-muted">
              No live subtitles yet. When speakers talk on stage or use speech-to-text, closed
              captions broadcast here!
            </div>
          }
          @for (cap of store.captions(); track cap.id) {
            <div class="p-2.5 rounded-xl bg-secondary/10 border border-secondary/30">
              <span class="font-bold text-[10px] text-secondary block mb-1"
                >🎙️ {{ cap.speaker_name }} (Live AI caption):</span
              >
              <p class="text-xs font-medium text-text-primary">
                {{ cap.text_content }}
              </p>
            </div>
          }
        }
      </div>

      @if (activeTab() === 'chat') {
        <div class="p-3 bg-surface-300 border-t border-surface-100 flex gap-2">
          <input
            hlmInput
            type="text"
            [(ngModel)]="inputText"
            (keyup.enter)="send()"
            placeholder="Send a chat message to the room..."
            class="flex-1 px-3 py-1.5 border rounded-xl bg-surface-200 text-xs focus:ring-2 focus:ring-primary"
          />
          <button
            hlmBtn
            (click)="send()"
            class="px-4 py-1.5 bg-primary hover:bg-primary-dark text-on-fill rounded-xl font-bold text-xs shadow"
          >
            Send
          </button>
        </div>
      }

      @if (activeTab() === 'subtitles' && store.isSpeaker()) {
        <div class="p-3 bg-secondary/10 border-t border-secondary/30 flex gap-2">
          <input
            hlmInput
            type="text"
            [(ngModel)]="inputCaption"
            (keyup.enter)="sendSubtitle()"
            placeholder="Simulate speech-to-text live subtitle broadcast..."
            class="flex-1 px-3 py-1.5 border rounded-xl bg-surface-200 text-xs focus:ring-2 focus:ring-secondary"
          />
          <button
            hlmBtn
            (click)="sendSubtitle()"
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-on-fill rounded-xl font-bold text-xs shadow"
          >
            Broadcast caption
          </button>
          <button
            hlmBtn
            (click)="broadcastAICaption()"
            class="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-on-fill rounded-xl font-bold text-xs shadow"
          >
            Broadcast AI Caption
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

  async broadcastAICaption(): Promise<void> {
    if (!this.inputCaption.trim()) return;
    await this.store.broadcastAICaption(this.inputCaption);
    this.inputCaption = '';
  }
}
