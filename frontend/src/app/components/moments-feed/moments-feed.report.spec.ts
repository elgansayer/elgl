import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { MomentRecord, MomentsStore } from '../../services/moments.store';
import { SafetyService } from '../../services/safety.service';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { UserService } from '../../services/user.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ReportUserModalService } from '../report-user-modal/report-user-modal.service';
import { MomentsFeedComponent } from './moments-feed.component';

const template = readFileSync(
  resolve(process.cwd(), 'src/app/components/moments-feed/moments-feed.component.html'),
  'utf8',
);

describe('MomentsFeedComponent reporting', () => {
  let fixture: ComponentFixture<MomentsFeedComponent>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    open = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MomentsFeedComponent],
      providers: [
        {
          provide: MomentsStore,
          useValue: { feed: signal([]), loadFeed: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: VocabularyStore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'me' }) } },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue({ target_languages: ['en'] }),
            searchUsers: vi.fn().mockResolvedValue([]),
          },
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
        { provide: ReportUserModalService, useValue: { open } },
      ],
    })
      .overrideComponent(MomentsFeedComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(MomentsFeedComponent);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('opens the shared report dialog for the Moment author with the Moment id', () => {
    const moment: MomentRecord = {
      id: 'moment-9',
      user_id: 'author-2',
      media_type: 'none',
      target_language: 'en',
      is_pinned: false,
      likes_count: 0,
      comments_count: 0,
      created_at: '2026-11-09T10:00:00.000Z',
    };

    fixture.componentInstance.reportMoment(moment);

    expect(open).toHaveBeenCalledExactlyOnceWith('author-2', undefined, 'moment-9');
  });

  describe('card template', () => {
    it('offers the action only on Moments written by someone else', () => {
      const guard = template.indexOf('@if (moment.user_id !== authService.currentUser()?.id) {');
      const action = template.indexOf('(click)="reportMoment(moment)"');

      expect(guard).toBeGreaterThan(-1);
      expect(action).toBeGreaterThan(guard);
      // The guard wraps only the report button, not the neighbouring actions.
      expect(template.indexOf('(click)="toggleComments(moment)"')).toBeGreaterThan(action);
    });

    it('labels the action through a translation key, never a literal', () => {
      const fromGuard = template.slice(
        template.indexOf('@if (moment.user_id !== authService.currentUser()?.id) {'),
      );
      const block = fromGuard.slice(0, fromGuard.indexOf('</button>'));

      expect(block).toContain("[attr.aria-label]=\"'moments.reportBtn' | t\"");
      expect(block).toContain("{{ 'moments.reportBtn' | t }}");
      expect(block).toContain('type="button"');
      expect(block).toContain('aria-hidden="true"');
    });
  });
});
