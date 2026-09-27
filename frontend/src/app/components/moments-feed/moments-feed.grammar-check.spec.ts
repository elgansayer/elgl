import { readFileSync } from 'fs';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DraftService } from '../../services/draft.service';
import { GRAMMAR_REVIEW_TOAST_MS } from '../../services/grammar-review';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore } from '../../services/moments.store';
import { SafetyService } from '../../services/safety.service';
import { toastsSignal } from '../../services/toast.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { MomentsFeedComponent } from './moments-feed.component';

describe('MomentsFeedComponent pre-publish grammar review', () => {
  let fixture: ComponentFixture<MomentsFeedComponent>;
  let component: MomentsFeedComponent;
  let createMoment: ReturnType<typeof vi.fn>;
  let checkGrammar: ReturnType<typeof vi.fn>;
  let saveMomentDraft: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;

  const flagged = {
    original: 'I go yesterday.',
    corrected: 'I went yesterday.',
    explanation: 'Use the past tense.',
    errors_found: 1,
  };

  beforeEach(async () => {
    toastsSignal.set([]);
    translate = vi.fn(
      (key: string, params?: Record<string, unknown>) =>
        `${key}:${String(params?.['explanation'] ?? '')}`,
    );
    createMoment = vi.fn().mockResolvedValue(undefined);
    checkGrammar = vi.fn();
    saveMomentDraft = vi.fn();

    await TestBed.configureTestingModule({
      imports: [MomentsFeedComponent],
      providers: [
        {
          provide: MomentsStore,
          useValue: {
            feed: signal([]),
            loadFeed: vi.fn().mockResolvedValue(undefined),
            createMoment,
          },
        },
        {
          provide: VocabularyStore,
          useValue: {
            checkGrammar,
            translateWordOrSentence: vi.fn(),
            saveWord: vi.fn(),
            updateSrsLevel: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'user-1' }) },
        },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue({ target_languages: ['ja'] }),
            searchUsers: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SafetyService,
          useValue: {
            mutedWords: signal<string[]>([]),
            filterMomentsByMutedWords: vi.fn((moments: unknown[]) => moments),
            addMutedWord: vi.fn(),
            removeMutedWord: vi.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            translations: signal({}),
            translate,
          },
        },
        {
          provide: DraftService,
          useValue: {
            loadMomentDraft: vi.fn().mockReturnValue(null),
            saveMomentDraft,
            clearMomentDraft: vi.fn(),
          },
        },
        {
          provide: TranslationCacheService,
          useValue: { get: vi.fn(), set: vi.fn() },
        },
      ],
    })
      .overrideComponent(MomentsFeedComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MomentsFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    toastsSignal.set([]);
    fixture.destroy();
  });

  it('replaces the draft with a suggestion and does not publish on the first submit', async () => {
    checkGrammar.mockResolvedValue(flagged);
    component.newText.set('I go yesterday.');
    component.newTargetLanguage.set('en-GB');

    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledWith('I go yesterday.', 'en-GB');
    expect(component.newText()).toBe('I went yesterday.');
    expect(saveMomentDraft).toHaveBeenCalled();
    expect(createMoment).not.toHaveBeenCalled();
    expect(component.isCreating()).toBe(false);
    expect(component.grammarReview()).toEqual({
      original: 'I go yesterday.',
      suggestion: 'I went yesterday.',
    });
  });

  it('keeps the composer open so the suggestion can be read and edited', async () => {
    checkGrammar.mockResolvedValue(flagged);
    component.showComposeForm.set(true);
    component.newText.set('I go yesterday.');

    await component.submitMoment();

    expect(component.showComposeForm()).toBe(true);
    expect(component.newText()).toBe('I went yesterday.');
  });

  it('explains the suggestion with a translated toast that stays readable', async () => {
    vi.useFakeTimers();
    checkGrammar.mockResolvedValue(flagged);
    component.newText.set('I go yesterday.');
    toastsSignal.set([]);

    await component.submitMoment();

    expect(translate).toHaveBeenCalledWith('grammarReview.suggestionApplied', {
      explanation: 'Use the past tense.',
    });
    expect(toastsSignal().map((toast) => toast.message)).toEqual([
      'grammarReview.suggestionApplied:Use the past tense.',
    ]);

    vi.advanceTimersByTime(GRAMMAR_REVIEW_TOAST_MS - 1);
    expect(toastsSignal()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toastsSignal()).toHaveLength(0);
  });

  it('publishes an accepted suggestion when the user submits it again', async () => {
    checkGrammar.mockResolvedValueOnce(flagged);
    component.showComposeForm.set(true);
    component.newText.set('I go yesterday.');
    component.newTargetLanguage.set('en-GB');

    await component.submitMoment();
    await component.submitMoment();

    // Accepting a reviewed suggestion must not spend a second provider call.
    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(createMoment).toHaveBeenCalledTimes(1);
    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({
        text_content: 'I went yesterday.',
        target_language: 'en-GB',
      }),
    );
    expect(component.grammarReview()).toBeNull();
    expect(component.newText()).toBe('');
  });

  it('closes the composer only after the Moment has been published', async () => {
    checkGrammar.mockResolvedValue({
      original: 'Fine.',
      corrected: 'Fine.',
      explanation: '',
      errors_found: 0,
    });
    let finishPublishing: (() => void) | undefined;
    createMoment.mockReturnValue(
      new Promise<void>((resolve) => {
        finishPublishing = resolve;
      }),
    );
    component.showComposeForm.set(true);
    component.newText.set('Fine.');

    const submission = component.submitMoment();
    await Promise.resolve();
    await Promise.resolve();
    expect(component.showComposeForm()).toBe(true);
    expect(component.isCreating()).toBe(true);

    finishPublishing?.();
    await submission;

    expect(component.showComposeForm()).toBe(false);
    expect(component.isCreating()).toBe(false);
  });

  it('keeps the composer open with the draft when publishing fails so it can be retried', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    checkGrammar.mockResolvedValue({
      original: 'Fine.',
      corrected: 'Fine.',
      explanation: '',
      errors_found: 0,
    });
    createMoment.mockRejectedValueOnce(new Error('Temporarily unavailable'));
    component.showComposeForm.set(true);
    component.newText.set('Fine.');

    await component.submitMoment();

    expect(component.showComposeForm()).toBe(true);
    expect(component.newText()).toBe('Fine.');
    expect(component.isCreating()).toBe(false);
    expect(toastsSignal().map((toast) => toast.message)).toContain('moments.publishError:');

    await component.submitMoment();

    expect(createMoment).toHaveBeenCalledTimes(2);
    expect(component.showComposeForm()).toBe(false);
    consoleError.mockRestore();
  });

  it('ignores a second submit while the first is still being processed', async () => {
    let resolveGrammar: ((value: unknown) => void) | undefined;
    checkGrammar.mockReturnValue(
      new Promise((resolve) => {
        resolveGrammar = resolve;
      }),
    );
    component.newText.set('Keep this.');

    const first = component.submitMoment();
    const second = component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(component.isCreating()).toBe(true);

    resolveGrammar?.({
      original: 'Keep this.',
      corrected: 'Keep this.',
      explanation: '',
      errors_found: 0,
    });
    await Promise.all([first, second]);

    expect(createMoment).toHaveBeenCalledTimes(1);
  });

  it('lets the author keep their own wording by resubmitting it after the suggestion', async () => {
    checkGrammar.mockResolvedValueOnce(flagged);
    component.newText.set('I go yesterday.');

    await component.submitMoment();
    component.newText.set('I go yesterday.');
    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I go yesterday.' }),
    );
  });

  it('checks again when the author edits the suggestion into new wording', async () => {
    checkGrammar.mockResolvedValueOnce(flagged).mockResolvedValueOnce({
      original: 'I went there yesterday.',
      corrected: 'I went there yesterday.',
      explanation: '',
      errors_found: 0,
    });
    component.newText.set('I go yesterday.');

    await component.submitMoment();
    component.newText.set('I went there yesterday.');
    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(2);
    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'I went there yesterday.' }),
    );
  });

  it('reviews again after the target language changes because it changes the check', async () => {
    checkGrammar.mockResolvedValueOnce(flagged).mockResolvedValueOnce({
      original: 'I went yesterday.',
      corrected: 'I went yesterday.',
      explanation: '',
      errors_found: 0,
    });
    component.newText.set('I go yesterday.');
    component.newTargetLanguage.set('en-GB');

    await component.submitMoment();
    component.onTargetLanguageSelected('en-US');
    expect(component.grammarReview()).toBeNull();
    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(2);
    expect(checkGrammar).toHaveBeenLastCalledWith('I went yesterday.', 'en-US');
  });

  it('keeps newer wording typed during the check instead of overwriting or publishing it', async () => {
    let resolveGrammar: ((value: unknown) => void) | undefined;
    checkGrammar.mockReturnValue(
      new Promise((resolve) => {
        resolveGrammar = resolve;
      }),
    );
    component.showComposeForm.set(true);
    component.newText.set('I go yesterday.');

    const submission = component.submitMoment();
    component.newText.set('I go yesterday. Then I');
    resolveGrammar?.(flagged);
    await submission;

    expect(component.newText()).toBe('I go yesterday. Then I');
    expect(component.grammarReview()).toBeNull();
    expect(createMoment).not.toHaveBeenCalled();
    expect(toastsSignal()).toHaveLength(0);
    expect(component.showComposeForm()).toBe(true);
    expect(component.isCreating()).toBe(false);
  });

  it('does not block publishing when the advisory checker degrades without a suggestion', async () => {
    checkGrammar.mockResolvedValue({
      original: 'Keep my text',
      corrected: 'Keep my text',
      explanation: 'Grammar check is currently unavailable',
      errors_found: 0,
    });
    component.newText.set('Keep my text');

    await component.submitMoment();

    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({ text_content: 'Keep my text' }),
    );
    expect(toastsSignal()).toHaveLength(0);
  });

  it('keeps the existing media-only publish path free of unnecessary grammar calls', async () => {
    component.newMediaUrls.set(['https://cdn.example.test/photo.jpg']);
    component.newMediaType.set('images');

    await component.submitMoment();

    expect(checkGrammar).not.toHaveBeenCalled();
    expect(createMoment).toHaveBeenCalledWith(expect.objectContaining({ text_content: undefined }));
  });
});

describe('Moments composer template pre-send contract', () => {
  const template = readFileSync(
    'src/app/components/moments-feed/moments-feed.component.html',
    'utf-8',
  );

  function postButton(): string {
    const buttons = [...template.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((match) => match[0]);
    const button = buttons.find((candidate) => candidate.includes('(click)="submitMoment()"'));
    expect(button).toBeDefined();
    return button ?? '';
  }

  it('leaves closing the composer to submitMoment so a suggestion stays visible', () => {
    expect(template).not.toMatch(/submitMoment\(\)\s*;\s*showComposeForm\.set\(false\)/);
    expect(postButton()).not.toContain('showComposeForm');
  });

  it('disables the Post button while a check or publish is running', () => {
    expect(postButton()).toContain('isCreating()');
    expect(postButton()).toMatch(/\[disabled\]="isCreating\(\)/);
  });

  it('lets the visible label name the Post button so its busy state is exposed', () => {
    expect(postButton()).not.toContain('aria-label');
    expect(postButton()).toContain("'moments.postBtn' | t");
    expect(postButton()).toContain("'moments.postingBtn' | t");
  });
});
