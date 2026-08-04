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
import { MomentsFeedComponent } from './moments-feed.component';
import type { MomentRecord, MomentComment } from '../../services/moments.store';
import { showToast } from '../../services/toast.service';

jest.mock('../../services/toast.service', () => ({
  showToast: jest.fn(),
}));

describe('MomentsFeedComponent', () => {
  let fixture: ComponentFixture<MomentsFeedComponent>;
  let component: MomentsFeedComponent;
  let mockMomentsStore: MomentsStore;
  let mockVocabStore: VocabularyStore;
  let mockAuthService: AuthService;
  let mockUserService: UserService;
  let mockI18nService: I18nService;

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

    loadFeed = jest.fn().mockImplementation(async (filter: string) => {
      this.activeFilter.set(filter);
      this.feed.set(filter === 'All' ? [...testMoments] : []);
    });

    createMoment = jest.fn().mockResolvedValue(undefined);
    loadComments = jest.fn().mockImplementation(async (momentId: string) => {
      const current = this.feed();
      const updated = current.map((m) =>
        m.id === momentId
          ? {
              ...m,
              comments: [
                {
                  id: 'c1',
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
    addComment = jest.fn().mockResolvedValue(undefined);
    togglePin = jest.fn();
    toggleLike = jest.fn();
  }

  class MockVocabStore {
    translateWordOrSentence = jest.fn().mockResolvedValue({
      translated_text: 'Hola',
    });
    saveWord = jest.fn().mockResolvedValue({ id: 'w1' });
    updateSrsLevel = jest.fn().mockResolvedValue(undefined);
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
      getMyProfile: jest.fn().mockResolvedValue({ target_languages: ['en'] } as never),
    } as unknown as UserService;

    mockI18nService = {
      translations: () => ({}),
      translate: (key: string, _params?: Record<string, unknown>) => key,
    } as unknown as I18nService;

    await TestBed.configureTestingModule({
      imports: [
        MomentsFeedComponent,
        CommonModule,
        FormsModule,
        TranslatePipe,
      ],
      providers: [
        { provide: MomentsStore, useValue: mockMomentsStore },
        { provide: VocabularyStore, useValue: mockVocabStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: UserService, useValue: mockUserService },
        { provide: I18nService, useValue: mockI18nService },
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
    (mockMomentsStore.loadFeed as jest.Mock).mockClear();
    await component.setFilter('Following');
    expect(mockMomentsStore.loadFeed).toHaveBeenCalledWith('Following');
  });

  it('adds a temporary image URL', () => {
    component.tempImageUrlInput = 'https://example.com/pic.jpg';
    component.addTempImageUrl();
    expect(component.newMediaUrls()).toEqual(['https://example.com/pic.jpg']);
    expect(component.newMediaType()).toBe('images');
  });

  it('shows a toast when more than 9 images are added', () => {
    for (let i = 0; i < 9; i += 1) {
      component.tempImageUrlInput = `https://example.com/${i}.jpg`;
      component.addTempImageUrl();
    }
    component.tempImageUrlInput = 'https://example.com/ten.jpg';
    component.addTempImageUrl();
    expect(showToast).toHaveBeenCalled();
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

  it('translates a moment inline', async () => {
    const moment = component.momentsStore.feed().find((m) => m.id === 'm1')!;
    await component.toggleInlineTranslation(moment);

    expect(mockVocabStore.translateWordOrSentence).toHaveBeenCalledWith(
      'Hello world',
      'en',
    );
    expect(moment.translatedText).toBe('Hola');
  });
});
