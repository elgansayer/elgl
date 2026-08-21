import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-search',
  imports: [CommonModule, FormsModule, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <div class="max-h-96 w-80 overflow-hidden rounded-xl border border-surface-100 bg-surface-200 shadow-2xl">
      <div class="border-b border-surface-100 p-3">
        <div class="relative">
          <input
            hlmInput
            type="text"
            [(ngModel)]="query"
            (input)="onSearch()"
            [placeholder]="'chatSearch.placeholder' | t"
            class="ps-9"
          />
          <span class="absolute start-3 top-2.5 text-sm text-text-muted" aria-hidden="true">🔍</span>
        </div>
      </div>

      <div class="flex gap-1 border-b border-surface-100 p-2" role="radiogroup">
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          class="rounded-full whitespace-nowrap"
          role="radio"
          [attr.aria-checked]="searchMode() === 'within'"
          [class.bg-primary]="searchMode() === 'within'"
          [class.text-on-fill]="searchMode() === 'within'"
          (click)="searchMode.set('within')"
        >
          {{ 'chatSearch.thisChat' | t }}
        </button>
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          class="rounded-full whitespace-nowrap"
          role="radio"
          [attr.aria-checked]="searchMode() === 'global'"
          [class.bg-primary]="searchMode() === 'global'"
          [class.text-on-fill]="searchMode() === 'global'"
          (click)="searchMode.set('global')"
        >
          {{ 'chatSearch.allChats' | t }}
        </button>
      </div>

      <div class="flex gap-1 overflow-x-auto border-b border-surface-100 p-2" role="radiogroup">
        @for (type of messageTypes; track type) {
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="sm"
            class="rounded-full whitespace-nowrap"
            role="radio"
            [attr.aria-checked]="selectedType() === type"
            [class.bg-primary]="selectedType() === type"
            [class.text-on-fill]="selectedType() === type"
            (click)="selectedType.set(type)"
          >
            {{ type }}
          </button>
        }
      </div>

      <div class="max-h-64 overflow-y-auto">
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
            hlmBtn
            type="button"
            variant="ghost"
            size="touch"
            class="h-auto w-full justify-start rounded-none border-b border-surface-100 px-3 py-2 text-start last:border-b-0"
            (click)="selectMessage(msg)"
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                @if (searchMode() === 'global') {
                  <span class="max-w-[120px] truncate rounded bg-surface-100 px-1.5 py-0.5 text-xs text-text-muted">
                    #{{ msg.room_id.slice(0, 8) }}
                  </span>
                }
                <span class="flex-1 truncate text-sm font-bold text-text-primary">
                  {{ msg.sender?.display_name || ('common.unknownSender' | t) }}
                </span>
              </span>
              <span class="mt-1 block truncate text-sm text-text-secondary">
                {{ msg.text_content || msg.message_type }}
              </span>
              <span class="mt-1 block text-[10px] text-text-muted">
                {{ msg.created_at | date: 'short' }}
              </span>
            </span>
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
      const query = this.query().trim();
      if (query.length < 2) {
        this.results.set([]);
        return;
      }
      this.isSearching.set(true);
      try {
        const mode = this.searchMode();
        const room = mode === 'within' && this.roomId() ? this.roomId() : undefined;
        const messages = await this.chatService.searchMessages(query, room);
        const type = this.selectedType();
        const filtered = type === 'All' ? messages : messages.filter((message) => message.message_type === type);
        this.results.set(filtered);
      } catch (error) {
        console.error('Search failed:', error);
        this.results.set([]);
      } finally {
        this.isSearching.set(false);
      }
    }, 300);
  }

  selectMessage(message: ChatMessage): void {
    this.messageSelect.emit(message);
    if (this.searchMode() === 'global' && message.room_id) {
      void this.router.navigate(['/chat', message.room_id]);
    }
  }
}
