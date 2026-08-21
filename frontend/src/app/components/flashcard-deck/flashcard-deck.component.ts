import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, ErrorHandler } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { DeckService, Deck, CreateDeckDto } from '../../services/deck.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from '../srs-error-boundary/srs-error-boundary.component';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { A11yClickableDirective } from '../primitives/a11y-clickable';

type DeckView = 'list' | 'detail';

const DECK_COLOURS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
];
const DECK_ICONS = [
  '📚',
  '🔥',
  '⭐',
  '🎯',
  '✈️',
  '💬',
  '🌍',
  '📖',
  '🎓',
  '🌟',
  '💡',
  '🗣️',
  '📝',
  '🎵',
  '🏆',
];

@Component({
  selector: 'app-flashcard-deck',
  standalone: true,
  imports: [
    HlmButton,
    TranslatePipe,
    SrsErrorBoundaryComponent,
    AppCardComponent,
    AppButtonPrimaryComponent,
    AppInputComponent,
    AppChipComponent,
    A11yClickableDirective,
  ],
  template: `
    <app-srs-error-boundary
      [context]="errorContext()"
      [showReportButton]="true"
      (retry)="handleRetry()"
    >
      <div class="mx-auto max-w-4xl space-y-6 pb-20">
        <!-- Header -->
        <app-card customClass="app-padded space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="app-section-title">{{ 'deck.title' | t }}</h2>
              <p class="app-muted">{{ 'deck.subtitle' | t }}</p>
            </div>
            <button
              hlmBtn
              type="button"
              (click)="activeView.set('list')"
              class="rounded-app border ps-3 pe-3 pt-2 pb-2 text-xs font-bold bg-surface-200 text-text-secondary border-surface-100"
            >
              {{ 'deck.browseBtn' | t }}
            </button>
          </div>
        </app-card>

        @if (activeView() === 'list') {
          <!-- Deck List -->
          <section class="space-y-4">
            <!-- Create Deck Button -->
            <div class="flex items-center gap-3">
              <app-button-primary (clicked)="toggleCreateForm()" customClass="text-xs font-bold">
                {{ (showCreateForm() ? 'deck.cancelBtn' : 'deck.createBtn') | t }}
              </app-button-primary>
              @if (decks().length > 0) {
                <span class="app-muted text-xs">{{
                  'deck.countLabel' | t: { count: decks().length }
                }}</span>
              }
            </div>

            <!-- Create Form -->
            @if (showCreateForm()) {
              <div class="rounded-card border border-surface-100 bg-surface-300 p-4 space-y-3">
                <h4 class="text-sm font-bold text-text-primary">{{ 'deck.createTitle' | t }}</h4>
                <div>
                  <app-input
                    [value]="newDeckName()"
                    (valueChange)="newDeckName.set($event)"
                    [placeholder]="'deck.namePlaceholder'"
                    label="deck.nameLabel"
                    inputId="new-deck-name-input"
                    customClass="w-full"
                    maxlength="60"
                  />
                </div>
                <div>
                  <app-input
                    [value]="newDeckDescription()"
                    (valueChange)="newDeckDescription.set($event)"
                    [placeholder]="'deck.descriptionPlaceholder'"
                    label="deck.descriptionLabel"
                    inputId="new-deck-description-input"
                    customClass="w-full"
                    maxlength="120"
                  />
                </div>
                <div class="flex flex-wrap gap-3">
                  <div class="min-w-[120px]">
                    <span class="mb-1 block text-xs font-bold text-text-primary">{{
                      'deck.colourLabel' | t
                    }}</span>
                    <div class="flex flex-wrap gap-1.5">
                      @for (c of deckColourOptions; track c) {
                        <button
                          hlmBtn
                          type="button"
                          (click)="newDeckColour.set(c)"
                          class="h-6 w-6 rounded-full border-2 transition-transform"
                          [style.background-color]="c"
                          [class.scale-125]="newDeckColour() === c"
                          [class.border-on-fill]="newDeckColour() === c"
                          [class.border-transparent]="newDeckColour() !== c"
                          [attr.aria-label]="'deck.colourAriaLabel' | t: { colour: c }"
                        >
                          <span class="sr-only">{{ c }}</span>
                        </button>
                      }
                    </div>
                  </div>
                  <div class="min-w-[120px]">
                    <span class="mb-1 block text-xs font-bold text-text-primary">{{
                      'deck.iconLabel' | t
                    }}</span>
                    <div class="flex flex-wrap gap-1.5">
                      @for (ic of deckIconOptions; track ic) {
                        <button
                          hlmBtn
                          type="button"
                          (click)="newDeckIcon.set(ic)"
                          class="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-transform"
                          [class.scale-125]="newDeckIcon() === ic"
                          [class.border-on-fill]="newDeckIcon() === ic"
                          [class.border-transparent]="newDeckIcon() !== ic"
                          [attr.aria-label]="ic"
                        >
                          {{ ic }}
                        </button>
                      }
                    </div>
                  </div>
                </div>
                <app-button-primary
                  (clicked)="createDeck()"
                  [disabled]="!newDeckName().trim() || isCreating()"
                  customClass="text-xs font-bold"
                >
                  {{ 'deck.saveBtn' | t }}
                </app-button-primary>
              </div>
            }

            <!-- Deck Grid -->
            @if (isLoading()) {
              <div class="py-12 text-center" role="status" aria-busy="true">
                <p class="app-muted text-sm">{{ 'deck.loading' | t }}</p>
              </div>
            } @else if (decks().length === 0) {
              <div class="app-empty-state py-12 text-center" role="status">
                <p class="text-3xl mb-3" aria-hidden="true">📚</p>
                <p class="font-bold text-text-primary">{{ 'deck.emptyTitle' | t }}</p>
                <p class="app-muted text-xs mt-1">{{ 'deck.emptyDesc' | t }}</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (deck of decks(); track deck.id) {
                  <article
                    class="rounded-card border border-surface-100 p-4 group transition-shadow cursor-pointer relative overflow-hidden"
                    [style.border-color]="deck.colour + '40'"
                    (click)="openDeckDetail(deck)"
                    appA11yClickable
                    tabindex="0"
                    [attr.aria-label]="'deck.openAriaLabel' | t: { name: deck.name }"
                  >
                    <div
                      class="absolute top-0 start-0 h-1 w-full rounded-t-card"
                      [style.background-color]="deck.colour"
                    ></div>
                    <div class="flex items-start justify-between pt-2">
                      <div class="flex items-center gap-2">
                        <span class="text-xl" aria-hidden="true">{{ deck.icon }}</span>
                        <div class="min-w-0">
                          <h3 class="text-sm font-bold text-text-primary truncate">
                            {{ deck.name }}
                          </h3>
                          @if (deck.description) {
                            <p class="text-xs text-text-secondary truncate mt-0.5">
                              {{ deck.description }}
                            </p>
                          }
                        </div>
                      </div>
                      <button
                        hlmBtn
                        type="button"
                        (click)="deleteDeckById(deck.id, $event)"
                        class="rounded-app p-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/20 hover:text-danger"
                        [attr.aria-label]="'deck.deleteAriaLabel' | t: { name: deck.name }"
                      >
                        <svg
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div class="mt-3 flex items-center gap-2 text-xs">
                      <app-chip customClass="text-[11px]">
                        {{ 'deck.cardCount' | t: { count: deck.card_count } }}
                      </app-chip>
                    </div>
                  </article>
                }
              </div>
            }
          </section>
        } @else if (activeView() === 'detail') {
          <!-- Deck Detail View -->
          @if (selectedDeck(); as deck) {
            <section class="space-y-4">
              <!-- Back + Header -->
              <div class="flex items-center gap-3">
                <button
                  hlmBtn
                  type="button"
                  (click)="activeView.set('list')"
                  class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary"
                >
                  ← {{ 'deck.backBtn' | t }}
                </button>
                <button
                  hlmBtn
                  type="button"
                  (click)="toggleEditForm()"
                  class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary"
                >
                  {{ 'deck.editBtn' | t }}
                </button>
                @if (deckCards().length > 0) {
                  <app-button-primary
                    size="sm"
                    (clicked)="startDeckReview(deck)"
                    customClass="font-bold"
                  >
                    {{ 'deck.startReview' | t }}
                  </app-button-primary>
                }
              </div>

              <app-card
                customClass="app-padded space-y-3"
                [style.border-color]="deck.colour + '40'"
              >
                <div
                  class="h-1 -mt-4 -mx-4 mb-0 rounded-t-card"
                  [style.background-color]="deck.colour"
                  style="width: calc(100% + 2rem);"
                ></div>
                <div class="flex items-center gap-3">
                  <span class="text-2xl" aria-hidden="true">{{ deck.icon }}</span>
                  <div>
                    <h3 class="text-lg font-bold text-text-primary">{{ deck.name }}</h3>
                    @if (deck.description) {
                      <p class="app-muted text-xs">{{ deck.description }}</p>
                    }
                  </div>
                </div>
                <app-chip>{{ 'deck.cardCount' | t: { count: deck.card_count } }}</app-chip>
              </app-card>

              <!-- Edit Form -->
              @if (showEditForm()) {
                <div class="rounded-card border border-surface-100 bg-surface-300 p-4 space-y-3">
                  <h4 class="text-sm font-bold text-text-primary">{{ 'deck.editTitle' | t }}</h4>
                  <div>
                    <app-input
                      [value]="editDeckName()"
                      (valueChange)="editDeckName.set($event)"
                      label="deck.nameLabel"
                      inputId="edit-deck-name-input"
                      customClass="w-full"
                      maxlength="60"
                    />
                  </div>
                  <div>
                    <app-input
                      [value]="editDeckDescription()"
                      (valueChange)="editDeckDescription.set($event)"
                      label="deck.descriptionLabel"
                      inputId="edit-deck-description-input"
                      customClass="w-full"
                      maxlength="120"
                    />
                  </div>
                  <div class="flex flex-wrap gap-3">
                    <div class="min-w-[120px]">
                      <span class="mb-1 block text-xs font-bold text-text-primary">{{
                        'deck.colourLabel' | t
                      }}</span>
                      <div class="flex flex-wrap gap-1.5">
                        @for (c of deckColourOptions; track c) {
                          <button
                            hlmBtn
                            type="button"
                            (click)="editDeckColour.set(c)"
                            class="h-6 w-6 rounded-full border-2 transition-transform"
                            [style.background-color]="c"
                            [class.scale-125]="editDeckColour() === c"
                            [class.border-on-fill]="editDeckColour() === c"
                            [class.border-transparent]="editDeckColour() !== c"
                            [attr.aria-label]="'deck.colourAriaLabel' | t: { colour: c }"
                          >
                            <span class="sr-only">{{ c }}</span>
                          </button>
                        }
                      </div>
                    </div>
                    <div class="min-w-[120px]">
                      <span class="mb-1 block text-xs font-bold text-text-primary">{{
                        'deck.iconLabel' | t
                      }}</span>
                      <div class="flex flex-wrap gap-1.5">
                        @for (ic of deckIconOptions; track ic) {
                          <button
                            hlmBtn
                            type="button"
                            (click)="editDeckIcon.set(ic)"
                            class="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-transform"
                            [class.scale-125]="editDeckIcon() === ic"
                            [class.border-on-fill]="editDeckIcon() === ic"
                            [class.border-transparent]="editDeckIcon() !== ic"
                            [attr.aria-label]="ic"
                          >
                            {{ ic }}
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <app-button-primary
                      (clicked)="saveDeckEdits()"
                      customClass="pt-2 pb-2 text-xs font-bold"
                    >
                      {{ 'deck.saveBtn' | t }}
                    </app-button-primary>
                    <button
                      hlmBtn
                      type="button"
                      (click)="showEditForm.set(false)"
                      class="rounded-app border ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary"
                    >
                      {{ 'deck.cancelBtn' | t }}
                    </button>
                  </div>
                </div>
              } @else {
                <!-- Available Flashcards to Add -->
                <app-card customClass="app-padded space-y-3">
                  <h4 class="text-sm font-bold text-text-primary">
                    {{ 'deck.addCardsTitle' | t }}
                  </h4>
                  @if (availableFlashcards().length === 0) {
                    <div class="app-empty-state py-4" role="status">
                      <p class="text-xs text-text-secondary">{{ 'deck.noCardsAvailable' | t }}</p>
                    </div>
                  } @else {
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      @for (fc of availableFlashcards(); track fc.id) {
                        <div
                          class="rounded-card flex items-center justify-between border border-surface-100 bg-surface-300 px-3 py-2"
                        >
                          <div class="min-w-0">
                            <span class="text-sm font-bold text-text-primary truncate">{{
                              fc.word_token
                            }}</span>
                            <span class="ms-2 text-xs text-success">{{ fc.translation }}</span>
                          </div>
                          <button
                            hlmBtn
                            type="button"
                            (click)="addCardToDeck(fc.id)"
                            class="rounded-app ms-2 bg-primary ps-2.5 pe-2.5 pt-1 pb-1 text-[11px] font-bold text-on-fill hover:opacity-90 flex-shrink-0"
                          >
                            {{ 'deck.addBtn' | t }}
                          </button>
                        </div>
                      }
                    </div>
                  }
                </app-card>

                <!-- Cards in Deck -->
                <app-card customClass="app-padded space-y-3">
                  <h4 class="text-sm font-bold text-text-primary">
                    {{ 'deck.cardsInDeck' | t: { count: deckCards().length } }}
                  </h4>
                  @if (deckCards().length === 0) {
                    <div class="app-empty-state py-4">
                      <p class="text-xs text-text-secondary">{{ 'deck.noCardsInDeck' | t }}</p>
                    </div>
                  } @else {
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      @for (fc of deckCards(); track fc.id) {
                        <div
                          class="rounded-card flex items-center justify-between border border-surface-100 bg-surface-300 px-3 py-2"
                        >
                          <div class="min-w-0">
                            <span class="text-sm font-bold text-text-primary truncate">{{
                              fc.word_token
                            }}</span>
                            <span class="ms-2 text-xs text-success">{{ fc.translation }}</span>
                            <app-chip customClass="ms-2">L{{ fc.srs_level }}</app-chip>
                          </div>
                          <button
                            hlmBtn
                            type="button"
                            (click)="removeCardFromDeck(fc.id)"
                            class="rounded-app ms-2 p-1 text-text-muted hover:bg-danger/20 hover:text-danger flex-shrink-0"
                            [attr.aria-label]="'deck.removeAriaLabel' | t: { word: fc.word_token }"
                          >
                            <svg
                              class="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </app-card>
              }
            </section>
          }
        }
      </div>
    </app-srs-error-boundary>
  `,
  styles: [
    `
      :host {
        display: block;
        padding-block-start: 1.5rem;
      }
    `,
  ],
})
export class FlashcardDeckComponent {
  private deckService = inject(DeckService);
  private vocabStore = inject(VocabularyStore);
  private i18n = inject(I18nService);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandler);
  private sanitisation = inject(HtmlSanitisationService);

  // View state
  readonly activeView = signal<DeckView>('list');
  readonly decks = signal<Deck[]>([]);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);

  // Create form
  readonly showCreateForm = signal(false);
  readonly newDeckName = signal('');
  readonly newDeckDescription = signal('');
  readonly newDeckColour = signal('#6366f1');
  readonly newDeckIcon = signal('📚');

  // Detail view
  readonly selectedDeck = signal<Deck | null>(null);
  readonly deckCardIds = signal<string[]>([]);
  readonly deckCards = signal<Flashcard[]>([]);
  readonly showEditForm = signal(false);
  readonly editDeckName = signal('');
  readonly editDeckDescription = signal('');
  readonly editDeckColour = signal('#6366f1');
  readonly editDeckIcon = signal('📚');

  readonly deckColourOptions = DECK_COLOURS;
  readonly deckIconOptions = DECK_ICONS;

  readonly availableFlashcards = computed(() => {
    const all = this.vocabStore.allFlashcards();
    const inDeck = new Set(this.deckCardIds());
    return all.filter((fc) => !inDeck.has(fc.id));
  });

  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'flashcard-deck',
    operation: this.activeView(),
    deckId: this.selectedDeck()?.id,
  }));

  /** Sanitises user-authored string fields of a deck against XSS via DOMPurify. */
  private sanitiseDeck(d: Deck): Deck {
    return {
      ...d,
      name: this.sanitisation.sanitiseText(d.name),
      description: d.description ? this.sanitisation.sanitiseText(d.description) : undefined,
    };
  }

  handleRetry(): void {
    void this.loadDecks();
  }

  private reportDeckError(operation: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const deckError = new Error(`[SRS:flashcard-deck] ${operation} failed: ${message}`);
    deckError.name = 'SrsDeckError';
    if (err instanceof Error && err.stack) {
      deckError.stack = err.stack;
    }
    const enriched = Object.assign(deckError, { srsOperation: operation });
    this.errorHandler.handleError(enriched);
  }

  constructor() {
    this.loadDecks();
  }

  async loadDecks(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.deckService.getDecks();
      this.decks.set(result.map((d) => this.sanitiseDeck(d)));
    } catch (e) {
      this.reportDeckError('loadDecks', e);
      // ignore
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleCreateForm(): void {
    if (this.showCreateForm()) {
      this.showCreateForm.set(false);
      this.newDeckName.set('');
      this.newDeckDescription.set('');
      this.newDeckColour.set('#6366f1');
      this.newDeckIcon.set('📚');
    } else {
      this.showCreateForm.set(true);
    }
  }

  async createDeck(): Promise<void> {
    const name = this.newDeckName().trim();
    if (!name) return;

    this.isCreating.set(true);
    try {
      const dto: CreateDeckDto = {
        name: this.sanitisation.sanitiseText(name),
        description: this.newDeckDescription().trim()
          ? this.sanitisation.sanitiseText(this.newDeckDescription().trim())
          : undefined,
        colour: this.newDeckColour(),
        icon: this.newDeckIcon(),
      };
      const deck = await this.deckService.createDeck(dto);
      this.decks.update((list) => [this.sanitiseDeck(deck), ...list]);
      this.toggleCreateForm();
    } catch (e) {
      this.reportDeckError('createDeck', e);
      // error silently
    } finally {
      this.isCreating.set(false);
    }
  }

  async openDeckDetail(deck: Deck): Promise<void> {
    this.selectedDeck.set(deck);
    this.showEditForm.set(false);
    this.activeView.set('detail');
    await this.loadDeckDetail(deck.id);
  }

  async loadDeckDetail(deckId: string): Promise<void> {
    await this.vocabStore.loadAllFlashcards();
    const ids = await this.deckService.getDeckFlashcards(deckId);
    this.deckCardIds.set(ids);
    const allCards = this.vocabStore.allFlashcards();
    this.deckCards.set(allCards.filter((fc) => ids.includes(fc.id)));
  }

  async addCardToDeck(flashcardId: string): Promise<void> {
    const deck = this.selectedDeck();
    if (!deck) return;
    try {
      await this.deckService.addFlashcardToDeck(deck.id, flashcardId);
      const card = this.vocabStore.allFlashcards().find((fc) => fc.id === flashcardId);
      if (card) {
        this.deckCards.update((list) => [card, ...list]);
      }
      this.deckCardIds.update((ids) => [...ids, flashcardId]);

      // Update card count locally
      this.decks.update((list) =>
        list.map((d) => (d.id === deck.id ? { ...d, card_count: d.card_count + 1 } : d)),
      );
      this.selectedDeck.update((d) => (d ? { ...d, card_count: d.card_count + 1 } : null));
    } catch (e) {
      this.reportDeckError('addCardToDeck', e);
      // ignore
    }
  }

  async removeCardFromDeck(flashcardId: string): Promise<void> {
    const deck = this.selectedDeck();
    if (!deck) return;
    try {
      await this.deckService.removeFlashcardFromDeck(deck.id, flashcardId);
      this.deckCards.update((list) => list.filter((fc) => fc.id !== flashcardId));
      this.deckCardIds.update((ids) => ids.filter((id) => id !== flashcardId));

      this.decks.update((list) =>
        list.map((d) =>
          d.id === deck.id ? { ...d, card_count: Math.max(0, d.card_count - 1) } : d,
        ),
      );
      this.selectedDeck.update((d) =>
        d ? { ...d, card_count: Math.max(0, d.card_count - 1) } : null,
      );
    } catch (e) {
      this.reportDeckError('removeCardFromDeck', e);
      // ignore
    }
  }

  async deleteDeckById(deckId: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.deckService.deleteDeck(deckId);
      this.decks.update((list) => list.filter((d) => d.id !== deckId));
    } catch (e) {
      this.reportDeckError('deleteDeck', e);
      // ignore
    }
  }

  startDeckReview(_deck: Deck): void {
    // Set pending review cards in the vocab store and navigate to review page
    this.vocabStore.pendingReviewCards.set([...this.deckCards()]);
    void this.router.navigate(['/review']);
  }

  toggleEditForm(): void {
    const deck = this.selectedDeck();
    if (!deck) return;
    if (this.showEditForm()) {
      this.showEditForm.set(false);
    } else {
      this.editDeckName.set(deck.name);
      this.editDeckDescription.set(deck.description ?? '');
      this.editDeckColour.set(deck.colour);
      this.editDeckIcon.set(deck.icon);
      this.showEditForm.set(true);
    }
  }

  async saveDeckEdits(): Promise<void> {
    const deck = this.selectedDeck();
    if (!deck) return;
    try {
      const updated = await this.deckService.updateDeck(deck.id, {
        name: this.sanitisation.sanitiseText(this.editDeckName().trim()),
        description: this.editDeckDescription().trim()
          ? this.sanitisation.sanitiseText(this.editDeckDescription().trim())
          : undefined,
        colour: this.editDeckColour(),
        icon: this.editDeckIcon(),
      });

      if (updated) {
        const sanitised = this.sanitiseDeck(updated);
        this.selectedDeck.set(sanitised);
        this.decks.update((list) => list.map((d) => (d.id === sanitised.id ? sanitised : d)));
      }
      this.showEditForm.set(false);
    } catch (e) {
      this.reportDeckError('saveDeckEdits', e);
      // ignore
    }
  }
}
