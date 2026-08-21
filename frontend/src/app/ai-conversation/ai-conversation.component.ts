import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { from } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AiConversationService, Scenario } from '../services/ai-conversation.service';
import { TranslatePipe } from '../services/translate.pipe';
import { TokenisedTextComponent } from '../components/tokenised-text/tokenised-text.component';
import { WordDefinitionModalComponent } from '../components/word-definition-modal/word-definition-modal.component';
import { UserService } from '../services/user.service';

const EMPTY_SCENARIO_LIST: Scenario[] = [];

interface ChatMessage {
  from: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-ai-conversation',
  standalone: true,
  imports: [
    HlmInput,
    HlmButton,
    CommonModule,
    FormsModule,
    TranslatePipe,
    TokenisedTextComponent,
    WordDefinitionModalComponent,
  ],
  host: {
    class: 'flex flex-col h-full bg-surface-500 text-text-primary',
  },
  template: `
    @if (!selectedScenario()) {
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <h2 class="text-lg font-semibold mb-3">{{ 'aiConversation.chooseScenario' | t }}</h2>
        <p class="text-text-secondary text-sm mb-4">
          {{ 'aiConversation.chooseScenarioDesc' | t }}
        </p>
        @for (scenario of scenarioList(); track scenario.id) {
          <button
            hlmBtn
            type="button"
            (click)="startScenario(scenario)"
            class="flex items-center gap-3 w-full text-start bg-surface-200 hover:bg-surface-300 active:bg-surface-400 text-text-primary px-4 py-3 rounded-xl transition-colors"
          >
            <span class="text-xl" aria-hidden="true">{{ scenario.icon }}</span>
            <span>{{ scenario.name }}</span>
          </button>
        }
      </div>
    } @else {
      <div class="flex items-center justify-between px-4 py-3 border-b border-surface-200">
        <div class="flex items-center gap-2">
          <button
            hlmBtn
            type="button"
            (click)="backToScenarios()"
            class="text-text-secondary hover:text-text-primary p-1"
            [attr.aria-label]="'aiConversation.backToScenarios' | t"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
          <span class="text-sm">{{ selectedScenario()!.icon }}</span>
          <span class="font-medium text-sm">{{ selectedScenario()!.name }}</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        @for (msg of messages(); track msg.text) {
          <div
            class="flex mb-2"
            [class.justify-end]="msg.from === 'user'"
            [class.justify-start]="msg.from === 'ai'"
          >
            <div
              class="relative max-w-[75%] px-4 py-3 rounded-2xl shadow-sm"
              [class.bg-primary]="msg.from === 'user'"
              [class.bg-surface-300]="msg.from === 'ai'"
              [class.text-on-fill]="msg.from === 'user'"
              [class.text-text-primary]="msg.from === 'ai'"
            >
              <div class="whitespace-pre-wrap break-words">
                <app-tokenised-text
                  [text]="msg.text"
                  [language]="targetLanguage()"
                  (wordClicked)="onWordClicked($event)"
                ></app-tokenised-text>
              </div>
              @if (msg.from === 'user') {
                <div
                  class="absolute -end-1.5 bottom-2 w-0 h-0
                         border-t-[8px] border-t-transparent
                         border-b-[8px] border-b-transparent
                         border-s-[10px] border-s-primary"
                ></div>
              } @else {
                <div
                  class="absolute -start-1.5 bottom-2 w-0 h-0
                         border-t-[8px] border-t-transparent
                         border-b-[8px] border-b-transparent
                         border-e-[10px] border-e-surface-300"
                ></div>
              }
            </div>
          </div>
        }
        @if (isLoading()) {
          <div class="flex justify-start">
            <div class="bg-surface-300 text-text-secondary px-3 py-2 rounded-xl animate-pulse">
              {{ 'aiConversation.typing' | t }}
            </div>
          </div>
        }
      </div>

      <div class="ps-4 pe-4 pb-4">
        <div class="flex items-center gap-2 bg-surface-200 rounded-full ps-4 pe-2 py-2">
          <input
            hlmInput
            type="text"
            class="flex-1 bg-transparent text-text-primary placeholder-text-secondary outline-none ps-0 pe-0"
            [placeholder]="'aiConversation.typeMessage' | t"
            [ngModel]="inputText()"
            (ngModelChange)="inputText.set($event)"
            (keydown.enter)="send()"
            [disabled]="isLoading()"
          />
          <button
            hlmBtn
            type="button"
            (click)="send()"
            [disabled]="isLoading() || !inputText().trim()"
            class="ps-3 pe-3 py-2 rounded-full bg-primary text-on-fill font-medium disabled:opacity-40"
          >
            {{ 'aiConversation.send' | t }}
          </button>
        </div>
      </div>
    }

    @if (activeWordToken(); as token) {
      <app-word-definition-modal
        [wordToken]="token"
        [contextSentence]="activeWordContext() ?? ''"
        (closed)="activeWordToken.set(null)"
      ></app-word-definition-modal>
    }
  `,
  styles: [],
})
export class AiConversationComponent implements OnInit {
  private aiService = inject(AiConversationService);
  private userService = inject(UserService);

  readonly scenarioList = toSignal(from(this.aiService.getScenarios()), {
    initialValue: EMPTY_SCENARIO_LIST,
  });

  readonly selectedScenario = signal<Scenario | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly inputText = signal('');
  readonly isLoading = signal(false);
  readonly targetLanguage = signal('en');
  readonly activeWordToken = signal<string | null>(null);
  readonly activeWordContext = signal<string | null>(null);

  async ngOnInit() {
    const profile = await this.userService.getMyProfile();
    if (profile && profile.target_languages && profile.target_languages.length > 0) {
      this.targetLanguage.set(profile.target_languages[0]);
    }
  }

  onWordClicked(event: { token: string; context: string }): void {
    this.activeWordToken.set(event.token);
    this.activeWordContext.set(event.context);
  }

  private currentScenarioId: string | undefined;

  startScenario(scenario: Scenario): void {
    this.selectedScenario.set(scenario);
    this.messages.set([]);
    this.currentScenarioId = scenario.id;
  }

  backToScenarios(): void {
    this.selectedScenario.set(null);
    this.messages.set([]);
    this.currentScenarioId = undefined;
  }

  async send(): Promise<void> {
    const text = this.inputText().trim();
    if (!text) return;
    this.messages.update((msgs) => [...msgs, { from: 'user', text }]);
    this.inputText.set('');
    this.isLoading.set(true);
    try {
      const conversationHistory = this.buildConversationHistory();
      const response = await this.aiService.sendMessage(
        text,
        this.currentScenarioId,
        conversationHistory,
      );
      this.messages.update((msgs) => [...msgs, { from: 'ai', text: response.reply }]);
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

  private buildConversationHistory(): { role: 'user' | 'assistant'; content: string }[] {
    return this.messages()
      .slice(-10)
      .map((msg) => ({
        role: msg.from === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.text,
      }));
  }
}
