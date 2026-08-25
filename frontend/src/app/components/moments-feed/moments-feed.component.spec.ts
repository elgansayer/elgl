import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore } from '../../services/moments.store';
import { VocabularyStore } from '../../services/vocabulary.store';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { MomentsFeedComponent } from './moments-feed.component';
import type { MomentRecord, MomentComment } from '../../services/moments.store';
import * as toastService from '../../services/toast.service';

describe.skip('MomentsFeedComponent', () => {
  let fixture: ComponentFixture<MomentsFeedComponent>;
  let component: MomentsFeedComponent;
  let mockMomentsStore: MomentsStore;
  let mockVocabStore: VocabularyStore;
  let mockAuthService: AuthService;
  let mockUserService: UserService;
  let mockI18nService: I18nService;
  let mockSafetyService: SafetyService;

  const testMoments: MomentRecord[] = [
    {
      id: 'm1',
      user_id: 'u1',
      author: {
        id: 'u1',
        display_name: 'Alice',
        avatar_url: '',
      },
      text_content: 'Hello world',
      created_at: new Date().toISOString(),
      media_urls: [],
      media_type: 'none',
      target_language: 'en',
      likes_count: 2,
      comments_count: 0,
      is_pinned: false,
      is_liked_by_me: false,
    },
  ];

  class MockMomentsStore {
    feed = signal<MomentRecord[]>([]);
    isLoading = signal<boolean>(false);
    activeFilter = signal<string>('All');

    loadFeed = vi.fn().mockImplementation(async (filter: string) => {
      this.activeFilter.set(filter);
      this.feed.set(filter === 'All' ? [...testMoments] : []);
    });

    createMoment = vi.fn().mockResolvedValue(undefined);
    loadComments = vi.fn().mockImplementation(async (momentId: string) => {
      const current = this.feed();
      const updated = current.map((m) =>
        m.id === momentId
          ? {
              ...m,
              comments: [
                {
                  id: 'c1',
        moment_id: 'm1',
        user_id: 'u2',
                  text_content: 'Nice post',
                  created_at: new Date().toISOString(),
                } as MomentComment,
              ],
            }
          : m,
      );
      this.feed.set(updated);
    });
    addComment = vi.fn().mockResolvedValue(undefined);
    togglePin = vi.fn();
    toggleLike = vi.fn();
  }

  class MockVocabStore {
    translateWordOrSentence = vi.fn().mockResolvedValue({
      translated_text: 'Hola',
    });
    saveWord = vi.fn().mockResolvedValue({ id: 'w1' });
    updateSrsLevel = vi.fn().mockResolvedValue(undefined);
    getWordStatus = vi.fn().mockReturnValue({
      level: 0,
      colorClass: '',
      colourClass: '',
    });
  }

  beforeEach(async () => {
    const store = new MockMomentsStore();
    store.feed.set(testMoments);
    mockMomentsStore = store as unknown as MomentsStore;

    mockVocabStore = new MockVocabStore() as unknown as VocabularyStore;

    mockAuthService = {
      currentUser: signal({ id: 'u1', user_metadata: { avatar_url: '' } }),
    } as unknown as AuthService;

    mockUserService = {
      getMyProfile: vi.fn().mockResolvedValue({ target_languages: ['en'] } as never),
    } as unknown as UserService;

    mockI18nService = {
      translations: () => ({}),
      translate: (key: string, _params?: Record<string, unknown>) => key,
    } as unknown as I18nService;

    mockSafetyService = {
      mutedWords: signal([] as string[]),
      filterMomentsByMutedWords: <T>(moments: T[]) => moments,
      addMutedWord: vi.fn(),
      removeMutedWord: vi.fn(),
    } as unknown as SafetyService;

    await TestBed.configureTestingModule({
      imports: [MomentsFeedComponent, CommonModule, FormsModule, TranslatePipe],
      providers: [
        { provide: MomentsStore, useValue: mockMomentsStore },
        { provide: VocabularyStore, useValue: mockVocabStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: SafetyService, useValue: mockSafetyService },
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MomentsFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads the feed with the All filter on init', async () => {
    expect(mockMomentsStore.loadFeed).toHaveBeenCalledWith('All');
    expect(component.momentsStore.feed()).toEqual(testMoments);
  });

  it('calls loadFeed when a filter is selected', async () => {
    vi.mocked(mockMomentsStore.loadFeed).mockClear();
    await component.setFilter('Following');
    expect(mockMomentsStore.loadFeed).toHaveBeenCalledWith('Following');
  });

  it('renders a text-to-speech control for moments with text content', () => {
    const ttsButton = fixture.nativeElement.querySelector('app-text-to-speech button');
    expect(ttsButton).toBeTruthy();
  });

  it('adds a temporary image URL', () => {
    component.tempImageUrlInput = 'https://example.com/pic.jpg';
    component.addTempImageUrl();
    expect(component.newMediaUrls()).toEqual(['https://example.com/pic.jpg']);
    expect(component.newMediaType()).toBe('images');
  });

  it('shows a toast when more than 9 images are added', () => {
    const toastCountBefore = toastService.toastsSignal().length;
    for (let i = 0; i < 9; i += 1) {
      component.tempImageUrlInput = `https://example.com/${i}.jpg`;
      component.addTempImageUrl();
    }
    component.tempImageUrlInput = 'https://example.com/ten.jpg';
    component.addTempImageUrl();
    expect(toastService.toastsSignal().length).toBeGreaterThan(toastCountBefore);
  });

  it('submits a new moment via createMoment', async () => {
    component.newText.set('Hello world');
    component.newMediaUrls.set([]);
    component.newMediaType.set('none');
    component.newTargetLanguage.set('en');

    await component.submitMoment();

    expect(mockMomentsStore.createMoment).toHaveBeenCalledWith({
      text_content: 'Hello world',
      media_urls: [],
      media_type: 'none',
      target_language: 'en',
    });
  });

  it('toggles comments and loads them when absent', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    moment.comments = undefined;

    await component.toggleComments(moment);

    expect(component.openCommentsMap().has('m1')).toBe(true);
    expect(mockMomentsStore.loadComments).toHaveBeenCalledWith('m1');
  });

  it('submits a text comment', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    component.commentInputMap[moment.id] = 'Great!';

    await component.submitComment(moment);

    expect(mockMomentsStore.addComment).toHaveBeenCalledWith('m1', {
      text_content: 'Great!',
      parent_comment_id: undefined,
      reply_to_user_id: undefined,
    });
  });

  it('submits a correction comment', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    component.correctionModeMap[moment.id] = true;
    component.correctionOriginalMap[moment.id] = 'Hello';
    component.correctionCorrectedMap[moment.id] = 'Hello!';
    component.correctionExplanationMap[moment.id] = 'Capital letter';

    await component.submitComment(moment);

    expect(mockMomentsStore.addComment).toHaveBeenCalledWith('m1', {
      correction_payload: {
        original: 'Hello',
        corrected: 'Hello!',
        explanation: 'Capital letter',
      },
      parent_comment_id: undefined,
      reply_to_user_id: undefined,
    });
  });

  it('sets the active word token when a word is clicked', () => {
    component.onWordClicked({ token: 'hello', context: 'Hello world' });
    expect(component.activeWordToken()).toBe('hello');
    expect(component.activeWordContext()).toBe('Hello world');
  });

  it('translates a moment inline and caches the result', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    await component.toggleInlineTranslation(moment);

    expect(mockVocabStore.translateWordOrSentence).toHaveBeenCalledWith('Hello world', 'en');
    expect(component.translationCache()['m1']).toBe('Hola');
    expect(component.showTranslationMap()['m1']).toBe(true);
  });

  it('hides a cached translation without re-fetching', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    // Pre-populate the cache
    component.translationCache.set({ m1: 'Hola' });
    component.showTranslationMap.set({ m1: true });
    vi.mocked(mockVocabStore.translateWordOrSentence).mockClear();

    await component.toggleInlineTranslation(moment);

    // Should hide translation without API call
    expect(mockVocabStore.translateWordOrSentence).not.toHaveBeenCalled();
    expect(component.showTranslationMap()['m1']).toBe(false);
    // Cache should still be intact
    expect(component.translationCache()['m1']).toBe('Hola');
  });

  it('shows a cached translation without re-fetching', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    // Pre-populate the cache but hidden
    component.translationCache.set({ m1: 'Hola' });
    component.showTranslationMap.set({ m1: false });
    vi.mocked(mockVocabStore.translateWordOrSentence).mockClear();

    await component.toggleInlineTranslation(moment);

    // Should show cached translation without API call
    expect(mockVocabStore.translateWordOrSentence).not.toHaveBeenCalled();
    expect(component.showTranslationMap()['m1']).toBe(true);
    expect(component.translationCache()['m1']).toBe('Hola');
  });

  // @mention autocomplete tests
  describe.skip('comment @mention autocomplete', () => {
    it('detects @mention trigger and stores query', () => {
      const momentId = 'm1';
      const input = document.createElement('input');
      input.value = 'Hello @Ali';
      input.selectionStart = 10;
      const event = { target: input } as unknown as Event;

      component.onCommentInput(event, momentId);

      expect(component.mentionQueryMap()[momentId]).toBe('Ali');
    });

    it('clears mention query when no @ trigger is present', () => {
      const momentId = 'm1';
      const input = document.createElement('input');
      input.value = 'Hello world';
      input.selectionStart = 11;
      const event = { target: input } as unknown as Event;

      component.onCommentInput(event, momentId);

      expect(component.mentionQueryMap()[momentId]).toBeNull();
    });

    it('formats mention text and clears the query after primitive selection', () => {
      const momentId = 'm1';
      const member = {
        id: 'u2',
        display_name: 'Alice',
        avatar_url: null,
      };
      component.commentInputMap[momentId] = 'Hello @Ali';
      (component as any).mentionRangeStartMap[momentId] = 6;
      (component as any).mentionRangeEndMap[momentId] = 10;
      component.mentionQueryMap.update((m) => ({ ...m, [momentId]: 'Ali' }));

      component.commentInputMap[momentId] = component.mentionItemToStringFor(momentId)(member);
      component.onMentionSelected(momentId, member);

      expect(component.commentInputMap[momentId]).toBe('Hello @Alice ');
      expect(component.mentionQueryMap()[momentId]).toBeNull();
    });

    it('preserves the comment when the primitive has no selected value', () => {
      const momentId = 'm1';
      component.commentInputMap[momentId] = 'Hello';
      const formatted = component.mentionItemToStringFor(momentId)(undefined);
      component.onMentionSelected(momentId, undefined);

      expect(formatted).toBe('Hello');
      expect(component.commentInputMap[momentId]).toBe('Hello');
    });

    it('starts a reply with correct context', () => {
      const comment: MomentComment = {
        id: 'c1',
        moment_id: 'm1',
        user_id: 'u2',
        text_content: 'Nice!',
        created_at: new Date().toISOString(),
        author: { id: 'u2', display_name: 'Bob', avatar_url: null },
      };

      component.startReply('m1', comment);

      expect(component.replyingToMap['m1']).toEqual({
        parentCommentId: 'c1',
        replyToUserId: 'u2',
        replyToName: 'Bob',
      });
    });

    it('cancels a reply', () => {
      component.startReply('m1', {
        id: 'c1',
        moment_id: 'm1',
        user_id: 'u2',
        text_content: 'Nice!',
        created_at: new Date().toISOString(),
        author: { id: 'u2', display_name: 'Bob', avatar_url: null },
      });
      expect(component.replyingToMap['m1']).not.toBeNull();

      component.cancelReply('m1');
      expect(component.replyingToMap['m1']).toBeNull();
    });
  });
});
