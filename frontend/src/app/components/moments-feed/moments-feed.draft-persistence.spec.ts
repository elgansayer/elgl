import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DraftService } from '../../services/draft.service';
import { I18nService } from '../../services/i18n.service';
import { MomentsStore } from '../../services/moments.store';
import { SafetyService } from '../../services/safety.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { MomentsFeedComponent } from './moments-feed.component';

const template = readFileSync(
  resolve(process.cwd(), 'src/app/components/moments-feed/moments-feed.component.html'),
  'utf8',
);

const momentKey = (userId: string): string => `ht_${userId}_draft_moment`;

describe('MomentsFeedComponent draft persistence', () => {
  let fixture: ComponentFixture<MomentsFeedComponent>;
  let component: MomentsFeedComponent;
  let draftService: DraftService;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let createMoment: ReturnType<typeof vi.fn>;
  let checkGrammar: ReturnType<typeof vi.fn>;
  let getMyProfile: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    for (let pass = 0; pass < 4; pass += 1) {
      await fixture.whenStable();
      await new Promise<void>((resolveTick) => setTimeout(resolveTick, 0));
      fixture.detectChanges();
    }
  }

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(MomentsFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }

  /**
   * Renders without waiting for Angular to become stable. `resource()` keeps the
   * application unstable until its loader settles, which is exactly what the
   * late-profile tests need to hold back.
   */
  async function createComponentWithPendingProfile(): Promise<void> {
    fixture = TestBed.createComponent(MomentsFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise<void>((resolveTick) => setTimeout(resolveTick, 0));
    fixture.detectChanges();
  }

  async function edit(change: () => void): Promise<void> {
    change();
    fixture.detectChanges();
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    createMoment = vi.fn().mockResolvedValue(undefined);
    checkGrammar = vi.fn().mockResolvedValue({
      original: '',
      corrected: '',
      explanation: '',
      errors_found: 0,
    });
    getMyProfile = vi.fn().mockResolvedValue({ target_languages: ['en'] });
    currentUser = signal<{ id: string } | null>({ id: 'user-1' });

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
        { provide: VocabularyStore, useValue: { checkGrammar } },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: UserService,
          useValue: { getMyProfile, searchUsers: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: SafetyService,
          useValue: {
            mutedWords: signal<string[]>([]),
            filterMomentsByMutedWords: vi.fn((moments: unknown[]) => moments),
          },
        },
        {
          provide: I18nService,
          useValue: { translations: signal({}), translate: vi.fn((key: string) => key) },
        },
        { provide: TranslationCacheService, useValue: { get: vi.fn(), set: vi.fn() } },
      ],
    })
      .overrideComponent(MomentsFeedComponent, { set: { template: '' } })
      .compileComponents();

    draftService = TestBed.inject(DraftService);
  });

  afterEach(() => {
    fixture?.destroy();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('saving while composing', () => {
    it('persists text edits straight away instead of waiting for the component to be destroyed', async () => {
      await createComponent();

      await edit(() => component.newText.set('A thought worth keeping'));

      expect(draftService.loadMomentDraft()?.text).toBe('A thought worth keeping');
    });

    it('persists media, language and voice changes straight away', async () => {
      await createComponent();

      await edit(() => {
        component.newMediaUrls.set(['https://cdn.example.com/voice.webm']);
        component.newMediaType.set('audio');
        component.onTargetLanguageSelected('ja');
      });

      expect(draftService.loadMomentDraft()).toMatchObject({
        mediaUrls: ['https://cdn.example.com/voice.webm'],
        mediaType: 'audio',
        targetLanguage: 'ja',
      });
    });

    it('records the voice duration with the audio attachment', async () => {
      await createComponent();

      component.onVoiceUploaded({ url: 'https://cdn.example.com/voice.webm', durationSec: 12 });
      fixture.detectChanges();
      await settle();

      expect(draftService.loadMomentDraft()).toMatchObject({
        mediaType: 'audio',
        voiceDurationSec: 12,
      });
    });

    it('removes the stored draft when the composer is emptied again', async () => {
      await createComponent();
      await edit(() => component.newText.set('Changed my mind'));
      expect(localStorage.getItem(momentKey('user-1'))).not.toBeNull();

      await edit(() => component.newText.set(''));

      expect(localStorage.getItem(momentKey('user-1'))).toBeNull();
    });

    it('flushes the latest edit when the component is destroyed before change detection runs', async () => {
      await createComponent();

      component.newText.set('Typed just before navigating away');
      fixture.destroy();

      expect(draftService.loadMomentDraft()?.text).toBe('Typed just before navigating away');
    });
  });

  describe('restoring', () => {
    it('restores the stored draft after the first render and opens the composer so it is visible', async () => {
      draftService.saveMomentDraft({
        text: 'Unsent Moment',
        mediaUrls: ['https://cdn.example.com/a.jpg'],
        mediaType: 'images',
        targetLanguage: 'ja',
      });

      await createComponent();

      expect(component.newText()).toBe('Unsent Moment');
      expect(component.newMediaUrls()).toEqual(['https://cdn.example.com/a.jpg']);
      expect(component.newMediaType()).toBe('images');
      expect(component.newTargetLanguage()).toBe('ja');
      expect(component.showComposeForm()).toBe(true);
    });

    it('leaves the composer closed when there is nothing to restore', async () => {
      await createComponent();

      expect(component.showComposeForm()).toBe(false);
      expect(component.newText()).toBe('');
    });

    it('does not delete the stored draft while restoring it', async () => {
      draftService.saveMomentDraft({ text: 'Survive hydration' });

      await createComponent();

      expect(draftService.loadMomentDraft()?.text).toBe('Survive hydration');
    });

    it('waits for the account to be known and never uses the shared anonymous namespace', async () => {
      localStorage.setItem(momentKey('user-1'), JSON.stringify({ text: 'Saved before reload' }));
      currentUser.set(null);
      const getItem = vi.spyOn(Storage.prototype, 'getItem');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      await createComponent();
      await edit(() => component.newText.set('Typed before sign-in finished'));

      expect(getItem.mock.calls.some(([key]) => String(key).startsWith('ht_anon'))).toBe(false);
      expect(setItem.mock.calls.some(([key]) => String(key).startsWith('ht_anon'))).toBe(false);
      expect(localStorage.getItem(momentKey('user-1'))).toContain('Saved before reload');
    });

    it('restores once the late-resolving account becomes available', async () => {
      localStorage.setItem(momentKey('user-1'), JSON.stringify({ text: 'Saved before reload' }));
      currentUser.set(null);
      await createComponent();
      expect(component.newText()).toBe('');

      await edit(() => currentUser.set({ id: 'user-1' }));

      expect(component.newText()).toBe('Saved before reload');
      expect(component.showComposeForm()).toBe(true);
    });

    it('keeps the restored language when the profile default resolves afterwards', async () => {
      let resolveProfile!: (profile: { target_languages: string[] }) => void;
      getMyProfile.mockReturnValue(
        new Promise((resolveValue) => {
          resolveProfile = resolveValue;
        }),
      );
      draftService.saveMomentDraft({ text: 'Konnichiwa', targetLanguage: 'ja' });

      await createComponentWithPendingProfile();
      expect(component.newTargetLanguage()).toBe('ja');
      resolveProfile({ target_languages: ['en'] });
      await settle();

      expect(component.newTargetLanguage()).toBe('ja');
    });

    it('applies the profile default when the user has not chosen a language', async () => {
      getMyProfile.mockResolvedValue({ target_languages: ['fr'] });

      await createComponent();

      expect(component.newTargetLanguage()).toBe('fr');
    });

    it('keeps a language the user picked over a profile default that resolves later', async () => {
      let resolveProfile!: (profile: { target_languages: string[] }) => void;
      getMyProfile.mockReturnValue(
        new Promise((resolveValue) => {
          resolveProfile = resolveValue;
        }),
      );
      await createComponentWithPendingProfile();

      component.onTargetLanguageSelected('es');
      resolveProfile({ target_languages: ['fr'] });
      await settle();

      expect(component.newTargetLanguage()).toBe('es');
    });

    it('does not carry one account composer into another account', async () => {
      draftService.saveMomentDraft({ text: 'Account one private draft' });
      await createComponent();
      expect(component.newText()).toBe('Account one private draft');

      await edit(() => currentUser.set({ id: 'user-2' }));
      expect(component.newText()).toBe('');
      await edit(() => component.newText.set('Account two draft'));

      expect(JSON.parse(localStorage.getItem(momentKey('user-1')) ?? '{}')).toMatchObject({
        text: 'Account one private draft',
      });
      expect(JSON.parse(localStorage.getItem(momentKey('user-2')) ?? '{}')).toMatchObject({
        text: 'Account two draft',
      });
    });
  });

  describe('publishing', () => {
    it('clears the stored draft and closes the composer only after the Moment is published', async () => {
      await createComponent();
      component.showComposeForm.set(true);
      await edit(() => component.newText.set('Ready to publish'));

      await component.submitMoment();
      fixture.detectChanges();
      await settle();

      expect(createMoment).toHaveBeenCalledTimes(1);
      expect(draftService.loadMomentDraft()).toBeNull();
      expect(component.newText()).toBe('');
      expect(component.showComposeForm()).toBe(false);
    });

    it('keeps the draft and the composer open when publishing fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      createMoment.mockRejectedValueOnce(new Error('offline'));
      await createComponent();
      component.showComposeForm.set(true);
      await edit(() => component.newText.set('Do not lose me'));

      await component.submitMoment();
      fixture.detectChanges();
      await settle();

      expect(component.newText()).toBe('Do not lose me');
      expect(component.showComposeForm()).toBe(true);
      expect(component.isCreating()).toBe(false);
      expect(draftService.loadMomentDraft()?.text).toBe('Do not lose me');
    });

    it('keeps the composer open so a grammar suggestion can be reviewed', async () => {
      checkGrammar.mockResolvedValueOnce({
        original: 'I go yesterday.',
        corrected: 'I went yesterday.',
        explanation: 'Use the past tense.',
        errors_found: 1,
      });
      await createComponent();
      component.showComposeForm.set(true);
      await edit(() => component.newText.set('I go yesterday.'));

      await component.submitMoment();
      fixture.detectChanges();
      await settle();

      expect(createMoment).not.toHaveBeenCalled();
      expect(component.showComposeForm()).toBe(true);
      expect(draftService.loadMomentDraft()?.text).toBe('I went yesterday.');
    });

    it('ignores a second publish while the first is still in flight', async () => {
      let releasePublish!: () => void;
      createMoment.mockImplementationOnce(
        () => new Promise<void>((resolveValue) => (releasePublish = resolveValue)),
      );
      await createComponent();
      await edit(() => component.newText.set('Publish once'));

      const first = component.submitMoment();
      await settle();
      const second = component.submitMoment();
      releasePublish();
      await Promise.all([first, second]);

      expect(createMoment).toHaveBeenCalledTimes(1);
    });

    it('keeps a newer composition written while an earlier publish is in flight', async () => {
      let releasePublish!: () => void;
      createMoment.mockImplementationOnce(
        () => new Promise<void>((resolveValue) => (releasePublish = resolveValue)),
      );
      await createComponent();
      component.showComposeForm.set(true);
      await edit(() => component.newText.set('First Moment'));

      const publishing = component.submitMoment();
      await settle();
      await edit(() => component.newText.set('Second Moment'));
      releasePublish();
      await publishing;
      await settle();

      expect(component.newText()).toBe('Second Moment');
      expect(component.showComposeForm()).toBe(true);
      expect(draftService.loadMomentDraft()?.text).toBe('Second Moment');
    });

    it('lets the component decide when the composer closes instead of the submit button', () => {
      expect(template).toContain('(click)="submitMoment()"');
      expect(template).not.toMatch(/submitMoment\(\);\s*showComposeForm\.set\(false\)/);
    });
  });
});
