import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-chat-search',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-80 max-h-96 overflow-hidden">
      <!-- Search input -->
      <div class="p-3 border-b border-gray-700">
        <div class="relative">
          <input type="text"
                 [(ngModel)]="query"
                 (input)="onSearch()"
                 placeholder="{{ 'chatSearch.placeholder' | t }}"
                 class="w-full bg-gray-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400" />
          <span class="absolute left-3 top-2.5 text-text-muted text-sm">🔍</span>
        </div>
      </div>

      <!-- Filter by type -->
      <div class="flex gap-1 p-2 border-b border-gray-700 overflow-x-auto">
        <button *ngFor="let type of messageTypes"
                (click)="selectedType.set(type)"
                class="px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors"
                [ngClass]="selectedType() === type ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'">
          {{ type }}
        </button>
      </div>

      <!-- Results -->
      <div class="overflow-y-auto max-h-64">
        <div *ngIf="isSearching()" class="p-4 text-center text-sm text-text-muted">
          {{ 'chatSearch.searching' | t }}
        </div>
        <div *ngIf="!isSearching() && results().length === 0 && query().length > 0"
             class="p-4 text-center text-sm text-text-muted">
          {{ 'chatSearch.noResults' | t }}
        </div>
        <button *ngFor="let msg of results()"
                (click)="onMessageSelect.emit(msg)"
                class="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0">
          <div class="text-xs text-text-muted mb-1">
            {{ msg.sender?.display_name || 'Unknown' }}
          </div>
          <div class="text-sm text-gray-200 truncate">
            {{ msg.text_content || msg.message_type }}
          </div>
          <div class="text-[10px] text-text-muted mt-1">
            {{ msg.created_at | date:'short' }}
          </div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ChatSearchComponent {
  private chatService = inject(ChatService);

  roomId = input.required<string>();
  onMessageSelect = output<ChatMessage>();

  query = signal('');
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
        const messages = await this.chatService.getMessages(this.roomId(), q);
        const type = this.selectedType();
        const filtered = type === 'All' ? messages : messages.filter(m => m.message_type === type);
        this.results.set(filtered);
      } catch (e) {
        console.error('Search failed:', e);
        this.results.set([]);
      } finally {
        this.isSearching.set(false);
      }
    }, 300);
  }
}
