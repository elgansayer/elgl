import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { DeckService, Deck, CreateDeckDto } from '../../services/deck.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

type DeckView = 'list' | 'detail';

const DECK_COLOURS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
const DECK_ICONS = ['📚', '🔥', '⭐', '🎯', '✈️', '💬', '🌍', '📖', '🎓', '🌟', '💡', '🗣️', '📝', '🎵', '🏆'];

@Component({
  selector: 'app-flashcard-deck',
  standalone: true,
  imports: [FormsModule, TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `
    <div class="mx-auto max-w-4xl space-y-6 pb-20">
      <!-- Header -->
      <section class="app-card app-padded space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="app-section-title">{{ 'deck.title' | t }}</h2>
            <p class="app-muted">{{ 'deck.subtitle' | t }}</p>
          </div>
          <button
            type="button"
            (click)="activeView.set('list')"
            class="rounded-app border ps-3 pe-3 pt-2 pb-2 text-xs font-bold bg-surface-200 text-text-secondary border-surface-100"
          >
            {{ 'deck.browseBtn' | t }}
          </button>
        </div>
      </section>

      @if (activeView() === 'list') {
        <!-- Deck List -->
        <section class="space-y-4">
          <!-- Create Deck Button -->
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="toggleCreateForm()"
              class="app-button-primary ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold disabled:opacity-60"
            >
              {{ (showCreateForm() ? 'deck.cancelBtn' : 'deck.createBtn') | t }}
            </button>
            @if (decks().length > 0) {
              <span class="app-muted text-xs">{{ 'deck.countLabel' | t: { count: decks().length } }}</span>
            }
          </div>

          <!-- Create Form -->
          @if (showCreateForm()) {
            <div class="rounded-card border border-surface-100 bg-surface-300 p-4 space-y-3">
              <h4 class="text-sm font-bold text-text-primary">{{ 'deck.createTitle' | t }}</h4>
              <div>
                <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.nameLabel' | t }}</span>
                <input
                  [(ngModel)]="newDeckName"
                  [placeholder]="'deck.namePlaceholder' | t"
                  class="app-input w-full"
                  maxlength="60"
                />
              </div>
              <div>
                <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.descriptionLabel' | t }}</span>
                <input
                  [(ngModel)]="newDeckDescription"
                  [placeholder]="'deck.descriptionPlaceholder' | t"
                  class="app-input w-full"
                  maxlength="120"
                />
              </div>
              <div class="flex flex-wrap gap-3">
                <div class="min-w-[120px]">
                  <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.colourLabel' | t }}</span>
                  <div class="flex flex-wrap gap-1.5">
                    @for (c of deckColourOptions; track c) {
                      <button
                        type="button"
                        (click)="newDeckColour.set(c)"
                        class="h-6 w-6 rounded-full border-2 transition-transform"
                        [style.background-color]="c"
                        [class.scale-125]="newDeckColour() === c"
                        [class.border-white]="newDeckColour() === c"
                        [class.border-transparent]="newDeckColour() !== c"
                        [attr.aria-label]="'deck.colourAriaLabel' | t: { colour: c }"
                      ><span class="sr-only">{{ c }}</span></button>
                    }
                  </div>
                </div>
                <div class="min-w-[120px]">
                  <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.iconLabel' | t }}</span>
                  <div class="flex flex-wrap gap-1.5">
                    @for (ic of deckIconOptions; track ic) {
                      <button
                        type="button"
                        (click)="newDeckIcon.set(ic)"
                        class="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-transform"
                        [class.scale-125]="newDeckIcon() === ic"
                        [class.border-white]="newDeckIcon() === ic"
                        [class.border-transparent]="newDeckIcon() !== ic"
                        [attr.aria-label]="ic"
                      >{{ ic }}</button>
                    }
                  </div>
                </div>
              </div>
              <button
                type="button"
                (click)="createDeck()"
                [disabled]="!newDeckName().trim() || isCreating()"
                class="app-button-primary ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold disabled:opacity-60"
              >
                {{ 'deck.saveBtn' | t }}
              </button>
            </div>
          }

          <!-- Deck Grid: Loading Skeleton -->
          @if (isLoading()) {
            <div class="space-y-4">
              @for (i of [1, 2, 3]; track i) {
                <div class="rounded-card border border-surface-100 p-4 space-y-3">
                  <div class="flex items-center gap-3">
                    <app-skeleton-loader [height]="'32px'" [width]="'32px'" [borderRadius]="'8px'" />
                    <div class="flex-1 space-y-2">
                      <app-skeleton-loader [height]="'16px'" [width]="'60%'" [variant]="'text'" />
                      <app-skeleton-loader [height]="'12px'" [width]="'40%'" [variant]="'text'" />
                    </div>
                  </div>
                  <app-skeleton-loader [height]="'20px'" [width]="'80px'" [borderRadius]="'999px'" />
                </div>
              }
            </div>
          } @else if (decks().length === 0) {
            <app-empty-state
              icon="📚"
              [title]="'deck.emptyTitle' | t"
              [description]="'deck.emptyDesc' | t"
              [actionLabel]="'deck.createBtn' | t"
              (actionClicked)="toggleCreateForm()"
            />
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (deck of decks(); track deck.id) {
                <article
                  class="rounded-card border border-surface-100 p-4 group transition-shadow cursor-pointer relative overflow-hidden"
                  [style.border-color]="deck.colour + '40'"
                  (click)="openDeckDetail(deck)"
                  (keyup.enter)="openDeckDetail(deck)"
                  role="button"
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
                        <h3 class="text-sm font-bold text-text-primary truncate">{{ deck.name }}</h3>
                        @if (deck.description) {
                          <p class="text-xs text-text-secondary truncate mt-0.5">{{ deck.description }}</p>
                        }
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="deleteDeckById(deck.id, $event)"
                      class="rounded-app p-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/20 hover:text-rose-400"
                      [attr.aria-label]="'deck.deleteAriaLabel' | t: { name: deck.name }"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div class="mt-3 flex items-center gap-2 text-xs">
                    <span class="app-chip text-[11px]">
                      {{ 'deck.cardCount' | t: { count: deck.card_count } }}
                    </span>
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
                type="button"
                (click)="activeView.set('list')"
                class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary"
              >
                ← {{ 'deck.backBtn' | t }}
              </button>
              <button
                type="button"
                (click)="toggleEditForm()"
                class="rounded-app border border-surface-100 ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary"
              >
                {{ 'deck.editBtn' | t }}
              </button>
              @if (deckCards().length > 0) {
                <button
                  type="button"
                  (click)="startDeckReview(deck)"
                  class="app-button-primary ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold"
                >
                  {{ 'deck.startReview' | t }}
                </button>
              }
            </div>

            <div class="app-card app-padded space-y-3" [style.border-color]="deck.colour + '40'">
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
              <span class="app-chip">{{ 'deck.cardCount' | t: { count: deck.card_count } }}</span>
            </div>

            <!-- Edit Form -->
            @if (showEditForm()) {
              <div class="rounded-card border border-surface-100 bg-surface-300 p-4 space-y-3">
                <h4 class="text-sm font-bold text-text-primary">{{ 'deck.editTitle' | t }}</h4>
                <div>
                  <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.nameLabel' | t }}</span>
                  <input [(ngModel)]="editDeckName" class="app-input w-full" maxlength="60" />
                </div>
                <div>
                  <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.descriptionLabel' | t }}</span>
                  <input [(ngModel)]="editDeckDescription" class="app-input w-full" maxlength="120" />
                </div>
                <div class="flex flex-wrap gap-3">
                  <div class="min-w-[120px]">
                    <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.colourLabel' | t }}</span>
                    <div class="flex flex-wrap gap-1.5">
                      @for (c of deckColourOptions; track c) {
                        <button
                          type="button"
                          (click)="editDeckColour.set(c)"
                          class="h-6 w-6 rounded-full border-2 transition-transform"
                          [style.background-color]="c"
                          [class.scale-125]="editDeckColour() === c"
                          [class.border-white]="editDeckColour() === c"
                          [class.border-transparent]="editDeckColour() !== c"
                        ><span class="sr-only">{{ c }}</span></button>
                      }
                    </div>
                  </div>
                  <div class="min-w-[120px]">
                    <span class="mb-1 block text-xs font-bold text-text-primary">{{ 'deck.iconLabel' | t }}</span>
                    <div class="flex flex-wrap gap-1.5">
                      @for (ic of deckIconOptions; track ic) {
                        <button
                          type="button"
                          (click)="editDeckIcon.set(ic)"
                          class="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-transform"
                          [class.scale-125]="editDeckIcon() === ic"
                          [class.border-white]="editDeckIcon() === ic"
                          [class.border-transparent]="editDeckIcon() !== ic"
                        >{{ ic }}</button>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button type="button" (click)="saveDeckEdits()" class="app-button-primary ps-4 pe-4 pt-2 pb-2 text-xs font-bold">
                    {{ 'deck.saveBtn' | t }}
                  </button>
                  <button type="button" (click)="showEditForm.set(false)" class="rounded-app border ps-3 pe-3 pt-1.5 pb-1.5 text-xs font-bold text-text-secondary">
                    {{ 'deck.cancelBtn' | t }}
                  </button>
                </div>
              </div>
            } @else {
              <!-- Available Flashcards to Add -->
              <div class="app-card app-padded space-y-3">
                <h4 class="text-sm font-bold text-text-primary">{{ 'deck.addCardsTitle' | t }}</h4>
                @if (availableFlashcards().length === 0) {
                  <app-empty-state
                    icon="📖"
                    [description]="'deck.noCardsAvailable' | t"
                    [customClass]="'py-4'"
                  />
                } @else {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    @for (fc of availableFlashcards(); track fc.id) {
                      <div
                        class="rounded-card flex items-center justify-between border border-surface-100 bg-surface-300 px-3 py-2"
                      >
                        <div class="min-w-0">
                          <span class="text-sm font-bold text-text-primary truncate">{{ fc.word_token }}</span>
                          <span class="ms-2 text-xs text-emerald-400">{{ fc.translation }}</span>
                        </div>
                        <button
                          type="button"
                          (click)="addCardToDeck(fc.id)"
                          class="rounded-app ms-2 bg-primary ps-2.5 pe-2.5 pt-1 pb-1 text-[11px] font-bold text-white hover:opacity-90 flex-shrink-0"
                        >
                          {{ 'deck.addBtn' | t }}
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Cards in Deck -->
              <div class="app-card app-padded space-y-3">
                <h4 class="text-sm font-bold text-text-primary">
                  {{ 'deck.cardsInDeck' | t: { count: deckCards().length } }}
                </h4>
                @if (deckCards().length === 0) {
                  <app-empty-state
                    icon="🃏"
                    [description]="'deck.noCardsInDeck' | t"
                    [customClass]="'py-4'"
                  />
                } @else {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    @for (fc of deckCards(); track fc.id) {
                      <div class="rounded-card flex items-center justify-between border border-surface-100 bg-surface-300 px-3 py-2">
                        <div class="min-w-0">
                          <span class="text-sm font-bold text-text-primary truncate">{{ fc.word_token }}</span>
                          <span class="ms-2 text-xs text-emerald-400">{{ fc.translation }}</span>
                          <span class="ms-2 app-chip">L{{ fc.srs_level }}</span>
                        </div>
                        <button
                          type="button"
                          (click)="removeCardFromDeck(fc.id)"
                          class="rounded-app ms-2 p-1 text-text-muted hover:bg-rose-500/20 hover:text-rose-400 flex-shrink-0"
                          [attr.aria-label]="'deck.removeAriaLabel' | t: { word: fc.word_token }"
                        >
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </section>
        }
      }
    </div>
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

  constructor() {
    this.loadDecks();
  }

  async loadDecks(): Promise<void> {
    this.isLoading.set(true);
    try {
      const result = await this.deckService.getDecks();
      this.decks.set(result);
    } catch {
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
        name,
        description: this.newDeckDescription().trim() || undefined,
        colour: this.newDeckColour(),
        icon: this.newDeckIcon(),
      };
      const deck = await this.deckService.createDeck(dto);
      this.decks.update((list) => [deck, ...list]);
      this.toggleCreateForm();
    } catch {
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
        list.map((d) =>
          d.id === deck.id ? { ...d, card_count: d.card_count + 1 } : d,
        ),
      );
      this.selectedDeck.update((d) =>
        d ? { ...d, card_count: d.card_count + 1 } : null,
      );
    } catch {
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
    } catch {
      // ignore
    }
  }

  async deleteDeckById(deckId: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.deckService.deleteDeck(deckId);
      this.decks.update((list) => list.filter((d) => d.id !== deckId));
    } catch {
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
        name: this.editDeckName().trim(),
        description: this.editDeckDescription().trim() || undefined,
        colour: this.editDeckColour(),
        icon: this.editDeckIcon(),
      });

      if (updated) {
        this.selectedDeck.set(updated);
        this.decks.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
      }
      this.showEditForm.set(false);
    } catch {
      // ignore
    }
  }
}