import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore } from '../../services/moments.store';
import { SafetyService } from '../../services/safety.service';
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

  beforeEach(async () => {
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
            translate: vi.fn((key: string) => key),
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
    fixture.destroy();
  });

  it('replaces the draft with a suggestion and does not publish on the first submit', async () => {
    checkGrammar.mockResolvedValue({
      original: 'I go yesterday.',
      corrected: 'I went yesterday.',
      explanation: 'Use the past tense.',
      errors_found: 1,
    });
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

  it('keeps the composer open while the suggestion is reviewed', async () => {
    checkGrammar.mockResolvedValue({
      original: 'I go yesterday.',
      corrected: 'I went yesterday.',
      explanation: 'Use the past tense.',
      errors_found: 1,
    });
    component.showComposeForm.set(true);
    component.newText.set('I go yesterday.');

    await component.submitMoment();

    expect(component.showComposeForm()).toBe(true);
  });

  it('publishes an accepted suggestion when the user submits it again', async () => {
    checkGrammar.mockResolvedValue({
      original: 'I go yesterday.',
      corrected: 'I went yesterday.',
      explanation: 'Use the past tense.',
      errors_found: 1,
    });
    component.newText.set('I go yesterday.');
    component.newTargetLanguage.set('en-GB');

    await component.submitMoment();
    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(1);
    expect(createMoment).toHaveBeenCalledTimes(1);
    expect(createMoment).toHaveBeenCalledWith(
      expect.objectContaining({
        text_content: 'I went yesterday.',
        target_language: 'en-GB',
      }),
    );
    expect(component.showComposeForm()).toBe(false);
    expect(component.grammarReview()).toBeNull();
  });

  it('ignores a concurrent second submission', async () => {
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

  it('keeps newer text entered while a grammar check is in flight', async () => {
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
    resolveGrammar?.({
      original: 'I go yesterday.',
      corrected: 'I went yesterday.',
      explanation: 'Use the past tense.',
      errors_found: 1,
    });
    await submission;

    expect(component.newText()).toBe('I go yesterday. Then I');
    expect(component.grammarReview()).toBeNull();
    expect(createMoment).not.toHaveBeenCalled();
    expect(component.showComposeForm()).toBe(true);
  });

  it('rechecks after the target language changes', async () => {
    checkGrammar
      .mockResolvedValueOnce({
        original: 'I go yesterday.',
        corrected: 'I went yesterday.',
        explanation: 'Use the past tense.',
        errors_found: 1,
      })
      .mockResolvedValueOnce({
        original: 'I went yesterday.',
        corrected: 'I went yesterday.',
        explanation: '',
        errors_found: 0,
      });
    component.newText.set('I go yesterday.');
    component.newTargetLanguage.set('en-GB');

    await component.submitMoment();
    component.onTargetLanguageSelected('en-US');
    await component.submitMoment();

    expect(checkGrammar).toHaveBeenCalledTimes(2);
    expect(checkGrammar).toHaveBeenLastCalledWith('I went yesterday.', 'en-US');
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
  });

  it('keeps the existing media-only publish path free of unnecessary grammar calls', async () => {
    component.newMediaUrls.set(['https://cdn.example.test/photo.jpg']);
    component.newMediaType.set('images');

    await component.submitMoment();

    expect(checkGrammar).not.toHaveBeenCalled();
    expect(createMoment).toHaveBeenCalledWith(expect.objectContaining({ text_content: undefined }));
  });
});
