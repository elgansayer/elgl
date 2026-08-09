import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-search',
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div
      class="bg-surface-200 border border-surface-100 rounded-xl shadow-2xl w-80 max-h-96 overflow-hidden"
    >
      <!-- Search input -->
      <div class="p-3 border-b border-surface-100">
        <div class="relative">
          <input
            type="text"
            [(ngModel)]="query"
            (input)="onSearch()"
            placeholder="{{ 'chatSearch.placeholder' | t }}"
            class="w-full bg-surface-100 text-white text-sm rounded-lg ps-9 pe-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
          />
          <span class="absolute start-3 top-2.5 text-text-muted text-sm">🔍</span>
        </div>
      </div>

      <!-- Mode toggle: in-chat vs global -->
      <div class="flex gap-1 p-2 border-b border-surface-100">
        <button
          (click)="searchMode.set('within')"
          [class]="
            searchMode() === 'within'
              ? 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-blue-600 text-white'
              : 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-surface-100 text-text-secondary hover:bg-gray-600'
          "
        >
          {{ 'chatSearch.thisChat' | t }}
        </button>
        <button
          (click)="searchMode.set('global')"
          [class]="
            searchMode() === 'global'
              ? 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-blue-600 text-white'
              : 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-surface-100 text-text-secondary hover:bg-gray-600'
          "
        >
          {{ 'chatSearch.allChats' | t }}
        </button>
      </div>

      <!-- Filter by type -->
      <div class="flex gap-1 p-2 border-b border-surface-100 overflow-x-auto">
        @for (type of messageTypes; track type) {
          <button
            (click)="selectedType.set(type)"
            [class]="
              selectedType() === type
                ? 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-blue-600 text-white'
                : 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-surface-100 text-text-secondary hover:bg-gray-600'
            "
          >
            {{ type }}
          </button>
        }
      </div>

      <!-- Results -->
      <div class="overflow-y-auto max-h-64">
        @if (isSearching()) {
          <div class="p-4 text-center text-sm text-text-muted">
            {{ 'chatSearch.searching' | t }}
          </div>
        }
        @if (!isSearching() && results().length === 0 && query().length > 0) {
          <div class="p-4 text-center text-sm text-text-muted">
            {{ 'chatSearch.noResults' | t }}
          </div>
        }
        @for (msg of results(); track msg.id) {
          <button
            (click)="selectMessage(msg)"
            class="w-full text-start px-3 py-2 hover:bg-surface-100 transition-colors border-b border-surface-100 last:border-b-0"
          >
            <div class="flex items-center gap-2">
              @if (searchMode() === 'global') {
                <span class="text-xs text-text-muted bg-surface-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                  #{{ msg.room_id.slice(0, 8) }}
                </span>
              }
              <p class="text-sm font-bold text-text-primary truncate flex-1">
                {{ msg.sender?.display_name || ('common.unknownSender' | t) }}
              </p>
            </div>
            <div class="text-sm text-gray-200 truncate mt-1">
              {{ msg.text_content || msg.message_type }}
            </div>
            <div class="text-[10px] text-text-muted mt-1">
              {{ msg.created_at | date: 'short' }}
            </div>
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ChatSearchComponent {
  private chatService = inject(ChatService);
  private router = inject(Router);

  roomId = input<string>('');
  messageSelect = output<ChatMessage>();

  query = signal('');
  searchMode = signal<'within' | 'global'>('within');
  selectedType = signal('All');
  results = signal<ChatMessage[]>([]);
  isSearching = signal(false);

  readonly messageTypes = ['All', 'text', 'voice', 'correction', 'doodle', 'gift'];

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async onSearch(): Promise<void> {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(async () => {
      const q = this.query().trim();
      if (q.length < 2) {
        this.results.set([]);
        return;
      }
      this.isSearching.set(true);
      try {
        const mode = this.searchMode();
        const room = mode === 'within' && this.roomId() ? this.roomId() : undefined;
        const messages = await this.chatService.searchMessages(q, room);
        const type = this.selectedType();
        const filtered =
          type === 'All' ? messages : messages.filter((m) => m.message_type === type);
        this.results.set(filtered);
      } catch (e) {
        console.error('Search failed:', e);
        this.results.set([]);
      } finally {
        this.isSearching.set(false);
      }
    }, 300);
  }

  selectMessage(msg: ChatMessage): void {
    this.messageSelect.emit(msg);
    if (this.searchMode() === 'global' && msg.room_id) {
      void this.router.navigate(['/chat', msg.room_id]);
    }
  }
}
