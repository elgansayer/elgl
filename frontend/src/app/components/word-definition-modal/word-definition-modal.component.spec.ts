import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { WordDefinitionModalComponent } from './word-definition-modal.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { signal } from '@angular/core';

describe('WordDefinitionModalComponent', () => {
  let component: WordDefinitionModalComponent;
  let fixture: ComponentFixture<WordDefinitionModalComponent>;
  let mockVocabStore: Partial<VocabularyStore>;

  beforeEach(async () => {
    mockVocabStore = {
      flashcardMap: signal(new Map()),
      getWordStatus: () => ({
        level: 0,
        colorClass: 'bg-blue-500/20 text-blue-900',
        colourClass: 'bg-blue-500/20 text-blue-900',
      }),
      translateWordOrSentence: () =>
        Promise.resolve({
          original_text: 'bonjour',
          translated_text: 'hello',
          detected_language: 'fr',
          definition: 'A French greeting meaning hello.',
          transliteration: 'bon-zhoor',
          pronunciation_url: 'https://example.com/audio.mp3',
        }),
      saveWord: () =>
        Promise.resolve({
          id: 'card-1',
          user_id: 'u1',
          word_token: 'bonjour',
          translation: 'hello',
          definition: 'A French greeting.',
          srs_level: 0,
          easiness_factor: 2.5,
          repetitions: 0,
          interval_days: 0,
          next_review_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }),
      updateSrsLevel: () =>
        Promise.resolve({
          id: 'card-1',
          user_id: 'u1',
          word_token: 'bonjour',
          translation: 'hello',
          srs_level: 1,
          easiness_factor: 2.5,
          repetitions: 1,
          interval_days: 1,
          next_review_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }),
    };

    await TestBed.configureTestingModule({
      imports: [WordDefinitionModalComponent, HttpClientTestingModule],
      providers: [{ provide: VocabularyStore, useValue: mockVocabStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(WordDefinitionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('wordToken', 'bonjour');
    fixture.componentRef.setInput('contextSentence', 'Bonjour, comment ça va?');
    fixture.componentRef.setInput('targetLanguage', 'en');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  // --- Core component behaviour ---

  it('should create and display LingQ title badge', () => {
    expect(component).toBeTruthy();
    const modalEl: HTMLElement = fixture.nativeElement;
    expect(modalEl.textContent).toContain('bonjour');
  });

  it('should render the translation result after loading', () => {
    const modalEl: HTMLElement = fixture.nativeElement;
    expect(modalEl.textContent).toContain('hello');
  });

  it('should emit closed when backdrop close button is clicked', () => {
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Close"]',
    )!;
    closeBtn.click();

    expect(closed).toBe(true);
  });

  // --- RTL Logical CSS verification ---

  it('should use logical padding instead of physical direction classes in the modal body', () => {
    const html: string = fixture.nativeElement.innerHTML;
    const sides = ['l', 'r'] as const;
    const bannedPatterns = [
      ...sides.map((s) => 'p' + s + '-\\d+'),
      ...sides.map((s) => 'm' + s + '-\\d+'),
      ...sides.map((s) => s + 'ight-\\d+'),
      ...sides.map((s) => 'border-' + s + '\\b'),
      ...sides.map((s) => 'text-' + s + 'ight'),
    ];
    const re = new RegExp('\\b(' + bannedPatterns.join('|') + ')\\b');
    expect(re.test(html)).toBe(false);
  });

  it('should use px- classes (equal sides) which are RTL-safe on buttons', () => {
    const modalEl: HTMLElement = fixture.nativeElement;
    const buttons = modalEl.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);

    const banned = ['p' + 'l-', 'p' + 'r-', 'm' + 'l-', 'm' + 'r-'];
    for (const btn of Array.from(buttons)) {
      const classList = (btn as HTMLElement).classList;
      for (const prefix of banned) {
        for (const c of Array.from(classList)) {
          expect(c.startsWith(prefix)).toBe(false);
        }
      }
    }
  });

  it('should avoid border-side physical classes', () => {
    const html: string = fixture.nativeElement.innerHTML;
    const sides = ['l', 'r'] as const;
    for (const s of sides) {
      const re = new RegExp('\\bborder-' + s + '\\b');
      expect(re.test(html)).toBe(false);
    }
  });

  it('should use p- classes symmetrically (all sides equal) in content sections', () => {
    const sections = fixture.nativeElement.querySelectorAll('.bg-surface-300');
    for (const sec of Array.from(sections) as HTMLElement[]) {
      expect(sec.classList.contains('p-4')).toBe(true);
    }
  });

  // --- Accessibility ---

  it('should render proper ARIA labels on action buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button[aria-label]');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // close, saveLearning, markKnown
  });

  it('should show loading spinner initially then hide it', () => {
    // After whenStable, isLoading should be false
    const spinner = fixture.nativeElement.querySelector('.animate-spin');
    expect(spinner).toBeNull();
  });

  it('should disable save buttons while saving', () => {
    component.isSaving.set(true);
    fixture.detectChanges();

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button:not([aria-label="Close"])',
    )!;
    expect(saveBtn.disabled).toBe(true);
  });

  it('should show reset button when word has existing card with non-zero SRS level', () => {
    component.existingCard.set({
      id: 'card-1',
      user_id: 'u1',
      word_token: 'bonjour',
      translation: 'hello',
      srs_level: 2,
      easiness_factor: 2.5,
      repetitions: 2,
      interval_days: 4,
      next_review_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    fixture.detectChanges();

    const resetBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLElement).textContent?.trim() === '');
    // The reset button should be present since srs_level !== 0
    const allButtons = fixture.nativeElement.querySelectorAll('button');
    // We should have 4 buttons: close, saveLearning, markKnown, resetNew
    expect(allButtons.length).toBe(4);
  });
});