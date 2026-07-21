import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioRoomsStore } from '../../services/audio-rooms.store';

@Component({
  selector: 'app-room-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-96 overflow-hidden">
      <!-- Header -->
      <div class="bg-slate-50 dark:bg-slate-900/60 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span class="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <span>💬 Synchronised Room Chat & Subtitles</span>
        </span>
        <button
          (click)="activeTab.set(activeTab() === 'chat' ? 'subtitles' : 'chat')"
          class="px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-colors"
          [ngClass]="activeTab() === 'subtitles' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'"
        >
          {{ activeTab() === 'subtitles' ? '💬 Show Chat' : '🎙️ Show AI Subtitles (' + store.captions().length + ')' }}
        </button>
      </div>

      <!-- Messages / Subtitles List -->
      <div class="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
        <ng-container *ngIf="activeTab() === 'chat'">
          <div *ngIf="store.roomMessages().length === 0" class="text-center py-12 text-slate-400">
            No messages in this live room yet. Say hello to the stage speakers!
          </div>
          <div *ngFor="let msg of store.roomMessages()" class="p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
            <div class="flex items-center justify-between font-bold text-[11px] text-slate-600 dark:text-slate-300 mb-0.5">
              <span>{{ msg.sender_name }}</span>
              <span class="text-[9px] text-slate-400">{{ msg.created_at | date:'shortTime' }}</span>
            </div>
            <p class="text-slate-800 dark:text-slate-100">{{ msg.text_content }}</p>
          </div>
        </ng-container>

        <ng-container *ngIf="activeTab() === 'subtitles'">
          <div *ngIf="store.captions().length === 0" class="text-center py-12 text-slate-400">
            No live subtitles yet. When speakers talk on stage or use speech-to-text, closed captions broadcast here!
          </div>
          <div *ngFor="let cap of store.captions()" class="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
            <span class="font-bold text-[10px] text-purple-900 dark:text-purple-300 block mb-1">🎙️ {{ cap.speaker_name }} (Live AI Caption):</span>
            <p class="text-xs font-medium text-slate-900 dark:text-white">{{ cap.text_content }}</p>
          </div>
        </ng-container>
      </div>

      <!-- Chat input -->
      <div *ngIf="activeTab() === 'chat'" class="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex gap-2">
        <input
          type="text"
          [(ngModel)]="inputText"
          (keyup.enter)="send()"
          placeholder="Send a chat message to the room..."
          class="flex-1 px-3 py-1.5 border rounded-xl bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-primary"
        />
        <button
          (click)="send()"
          class="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow"
        >
          Send
        </button>
      </div>

      <!-- Caption simulation tool for speakers -->
      <div *ngIf="activeTab() === 'subtitles' && store.isSpeaker()" class="p-3 bg-purple-50 dark:bg-purple-950/60 border-t border-purple-200 dark:border-purple-800 flex gap-2">
        <input
          type="text"
          [(ngModel)]="inputCaption"
          (keyup.enter)="sendSubtitle()"
          placeholder="Simulate speech-to-text live subtitle broadcast..."
          class="flex-1 px-3 py-1.5 border rounded-xl bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-600"
        />
        <button
          (click)="sendSubtitle()"
          class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow"
        >
          Broadcast Caption
        </button>
      </div>
    </div>
  `
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
