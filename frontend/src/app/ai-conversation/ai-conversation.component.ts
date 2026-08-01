import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AiConversationService, Scenario } from '../services/ai-conversation.service';

interface ChatMessage {
  from: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-ai-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    class: 'flex flex-col h-full bg-[#121212] text-white',
  },
  template: `
    @if (!selectedScenario()) {
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        <h2 class="text-lg font-semibold mb-2">Choose a role-play scenario</h2>
        @for (scenario of scenarioList(); track scenario.id) {
          <button
            type="button"
            (click)="startScenario(scenario)"
            class="block w-full text-start bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-3 rounded-xl"
          >
            {{ scenario.name }}
          </button>
        }
      </div>
    } @else {
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        @for (msg of messages(); track msg.text) {
          <div
            class="flex mb-2"
            [class.justify-end]="msg.from === 'user'"
            [class.justify-start]="msg.from === 'ai'"
          >
            <div
              class="relative max-w-[75%] px-4 py-3 rounded-2xl shadow-sm"
              [class.bg-green-600]="msg.from === 'user'"
              [class.bg-neutral-800]="msg.from === 'ai'"
              [class.text-white]="msg.from === 'user'"
              [class.text-gray-200]="msg.from === 'ai'"
            >
              <span class="whitespace-pre-wrap break-words">{{ msg.text }}</span>
              @if (msg.from === 'user') {
                <div
                  class="absolute -end-1.5 bottom-2 w-0 h-0
                         border-t-[8px] border-t-transparent
                         border-b-[8px] border-b-transparent
                         border-s-[10px] border-s-green-600"
                ></div>
              } @else {
                <div
                  class="absolute -start-1.5 bottom-2 w-0 h-0
                         border-t-[8px] border-t-transparent
                         border-b-[8px] border-b-transparent
                         border-e-[10px] border-e-neutral-800"
                ></div>
              }
            </div>
          </div>
        }
        @if (isLoading()) {
          <div class="flex justify-start">
            <div class="bg-neutral-800 text-slate-400 px-3 py-2 rounded-xl animate-pulse">
              Writing...
            </div>
          </div>
        }
      </div>

      <div class="ps-4 pe-4 pb-4">
        <div class="flex items-center gap-2 bg-neutral-800 rounded-full ps-4 pe-2 py-2">
          <input
            type="text"
            class="flex-1 bg-transparent text-white placeholder-neutral-400 outline-none ps-0 pe-0"
            placeholder="Type your message..."
            [ngModel]="inputText()"
            (ngModelChange)="inputText.set($event)"
            (keydown.enter)="send()"
            [disabled]="isLoading()"
          />
          <button
            type="button"
            (click)="send()"
            [disabled]="isLoading() || !inputText().trim()"
            class="ps-3 pe-3 py-2 rounded-full bg-green-600 text-white font-medium disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    }
  `,
  styles: [],
})
export class AiConversationComponent {
  private aiService = inject(AiConversationService);

  readonly scenarioList = toSignal(
    from(this.aiService.getScenarios()),
    { initialValue: [] as Scenario[] },
  );

  readonly selectedScenario = signal<Scenario | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly inputText = signal('');
  readonly isLoading = signal(false);

  private currentScenarioId: string | undefined;

  startScenario(scenario: Scenario): void {
    this.selectedScenario.set(scenario);
    this.messages.set([]);
    this.currentScenarioId = scenario.id;
  }

  async send(): Promise<void> {
    const text = this.inputText().trim();
    if (!text) return;
    this.messages.update((msgs) => [...msgs, { from: 'user', text }]);
    this.inputText.set('');
    this.isLoading.set(true);
    try {
      const response = await this.aiService.sendMessage(
        text,
        this.currentScenarioId,
      );
      if (this.isValidResponse(response)) {
        const { reply } = response;
        this.messages.update((msgs) => [...msgs, { from: 'ai', text: reply }]);
      } else {
        throw new Error('Invalid response format');
      }
      this.messages.update((msgs) => [...msgs, { from: 'ai', text: reply }]);
    } catch {
      this.messages.update((msgs) => [
        ...msgs,
        {
          from: 'ai',
          text: 'Sorry, I am having trouble responding. Please try again.',
        },
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }
}
