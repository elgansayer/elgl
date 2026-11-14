import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { ChatService, GroupVocabularyEntry } from '../../services/chat.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

@Component({
  selector: 'app-group-vocabulary-bank',
  imports: [
    TranslatePipe,
    AppInputComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mt-2 rounded-card border border-surface-200 bg-surface-200/60 ps-3 pe-3 pt-3 pb-3"
      [attr.aria-label]="'chatRoom.vocabularyTitle' | t"
    >
      <h3 class="text-sm font-bold text-text-primary">{{ 'chatRoom.vocabularyTitle' | t }}</h3>

      @if (loading()) {
        <p class="mt-2 text-xs text-text-secondary" role="status" aria-busy="true">
          {{ 'chatRoom.vocabularyLoading' | t }}
        </p>
      } @else if (loadError()) {
        <p class="mt-2 text-xs text-danger-ink" role="alert">
          {{ 'chatRoom.vocabularyError' | t }}
        </p>
      } @else if (entries().length === 0) {
        <p class="mt-2 text-xs text-text-secondary">{{ 'chatRoom.vocabularyEmpty' | t }}</p>
      } @else {
        <ul class="mt-2 space-y-1">
          @for (entry of entries(); track entry.id) {
            <li
              class="flex items-start justify-between gap-2 rounded-card bg-surface-300/60 ps-2 pe-2 pt-1.5 pb-1.5"
            >
              <div class="min-w-0">
                <p class="truncate text-xs font-bold text-text-primary" [attr.dir]="'auto'">
                  {{ entry.term }}
                </p>
                <p class="truncate text-xs text-text-secondary" [attr.dir]="'auto'">
                  {{ entry.translation }}
                </p>
              </div>
              <app-button-secondary
                customClass="shrink-0 ps-2 pe-2 pt-1 pb-1 text-xs text-danger-ink"
                [ariaLabel]="'chatRoom.vocabularyDeleteAria' | t: { term: entry.term }"
                [disabled]="deletingId() === entry.id"
                (clicked)="remove(entry)"
              >
                {{ 'chatRoom.vocabularyDeleteBtn' | t }}
              </app-button-secondary>
            </li>
          }
        </ul>
      }

      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <app-input
          [value]="term()"
          (valueChange)="term.set($event)"
          [placeholder]="'chatRoom.vocabularyTermPlaceholder'"
          customClass="pt-2 pb-2 text-xs"
        />
        <app-input
          [value]="translation()"
          (valueChange)="translation.set($event)"
          [placeholder]="'chatRoom.vocabularyTranslationPlaceholder'"
          customClass="pt-2 pb-2 text-xs"
        />
        <app-input
          [value]="language()"
          (valueChange)="language.set($event)"
          [placeholder]="'chatRoom.vocabularyLanguagePlaceholder'"
          customClass="pt-2 pb-2 text-xs"
        />
      </div>
      <app-button-primary
        customClass="mt-2 ps-3 pe-3 pt-2 pb-2 text-xs"
        [disabled]="saving() || !canSubmit()"
        (clicked)="add()"
      >
        {{ 'chatRoom.vocabularyAddBtn' | t }}
      </app-button-primary>
      @if (saveError()) {
        <p class="mt-1 text-xs text-danger-ink" role="alert">
          {{ 'chatRoom.vocabularySaveError' | t }}
        </p>
      }
    </section>
  `,
})
export class GroupVocabularyBankComponent implements OnInit {
  readonly roomId = input.required<string>();

  private readonly chatService = inject(ChatService);

  readonly entries = signal<GroupVocabularyEntry[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly term = signal('');
  readonly translation = signal('');
  readonly language = signal('');

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  canSubmit(): boolean {
    return (
      this.term().trim().length > 0 &&
      this.translation().trim().length > 0 &&
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(this.language().trim())
    );
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      this.entries.set(await this.chatService.getGroupVocabulary(this.roomId()));
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async add(): Promise<void> {
    if (!this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(false);
    try {
      const created = await this.chatService.addGroupVocabulary(this.roomId(), {
        term: this.term().trim(),
        translation: this.translation().trim(),
        language: this.language().trim(),
      });
      this.entries.update((list) => [...list, created]);
      this.term.set('');
      this.translation.set('');
      this.language.set('');
    } catch {
      this.saveError.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(entry: GroupVocabularyEntry): Promise<void> {
    if (this.deletingId()) return;
    this.deletingId.set(entry.id);
    try {
      await this.chatService.deleteGroupVocabulary(this.roomId(), entry.id);
      this.entries.update((list) => list.filter((item) => item.id !== entry.id));
    } catch {
      this.saveError.set(true);
    } finally {
      this.deletingId.set(null);
    }
  }
}
