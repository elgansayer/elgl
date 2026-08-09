import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BlockManagementComponent } from './block-management.component';
import {
  BlockedUserResponse,
  BlockedUsersService,
} from '../../services/blocked-users.service';
import { I18nService } from '../../services/i18n.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('BlockManagementComponent RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(
      resolve(__dirname, 'block-management.component.html'),
      'utf-8',
    );
  });

  it('should not contain any physical direction CSS utilities', () => {
    const violations = [
      /\bpl-\d/, /\bpr-\d/, /\bml-\d/, /\bmr-\d/,
      /\bleft-[0-9]/, /\bright-[0-9]/,
      /\bborder-l\b/, /\bborder-r\b/,
      /\btext-left\b/, /\btext-right\b/,
    ];
    for (const pattern of violations) {
      expect(templateContent).not.toMatch(pattern);
    }
  });

  it('should use logical CSS utilities for inline start/end padding', () => {
    expect(templateContent).toContain('ps-4');
    expect(templateContent).toContain('pe-4');
  });

  it('should use logical CSS utilities for inline start margin', () => {
    expect(templateContent).toContain('ms-1');
  });

  it('should use i18n translate pipe for all user-facing strings', () => {
    const keys = [
      "'safety.blockManagement.title'",
      "'safety.blockManagement.loadError'",
      "'safety.blockManagement.loadErrorDesc'",
      "'safety.blockManagement.emptyTitle'",
      "'safety.blockManagement.emptyDesc'",
      "'safety.blockManagement.unblock'",
    ];
    for (const key of keys) {
      expect(templateContent).toContain(key);
    }
  });

  it('should not hardcode English user-facing strings', () => {
    // Strip i18n expressions (both template and attribute forms) to check
    // for hardcoded English remaining in pure HTML text nodes
    const withoutI18n = templateContent
      .replace(/\{\{.*?\}\}/gs, '')
      .replace(/'[^']*'\s*\|\s*t/g, '');
    expect(withoutI18n).not.toMatch(/Blocked Users/);
    expect(withoutI18n).not.toMatch(/\bUnblock\b/);
    expect(withoutI18n).not.toMatch(/Failed to load/);
    expect(withoutI18n).not.toMatch(/No blocked users/);
  });
});

describe('BlockManagementComponent', () => {
  let component: BlockManagementComponent;
  let fixture: ComponentFixture<BlockManagementComponent>;
  let blockedUsersSignal: ReturnType<typeof signal<BlockedUserResponse[]>>;
  let loadingSignal: ReturnType<typeof signal<boolean>>;
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let unblockUserSpy: ReturnType<typeof vi.fn>;
  let loadBlockedUsersSpy: ReturnType<typeof vi.fn>;

  const mockI18nService = {
    translate: (key: string) => key,
  };

  const user = (overrides: Partial<BlockedUserResponse> = {}): BlockedUserResponse => ({
    id: 'user-1',
    display_name: 'Ada Lovelace',
    native_language: 'English',
    target_languages: ['French', 'German'],
    ...overrides,
  });

  beforeEach(async () => {
    blockedUsersSignal = signal<BlockedUserResponse[]>([]);
    loadingSignal = signal<boolean>(false);
    errorSignal = signal<string | null>(null);
    unblockUserSpy = vi.fn().mockResolvedValue(undefined);
    loadBlockedUsersSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [BlockManagementComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers: blockedUsersSignal.asReadonly(),
            isLoading: loadingSignal.asReadonly(),
            error: errorSignal.asReadonly(),
            unblockUser: unblockUserSpy,
            loadBlockedUsers: loadBlockedUsersSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockManagementComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows skeleton loaders when loading', () => {
    loadingSignal.set(true);
    fixture.detectChanges();

    const skeletonEls = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletonEls.length).toBeGreaterThan(0);

    const title = fixture.nativeElement.querySelector('h1');
    expect(title.textContent).toContain('safety.blockManagement.title');
  });

  it('shows error empty state when load error occurs', () => {
    errorSignal.set('Failed to load blocked users');
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    const btn = emptyState.querySelector('button');
    expect(btn).toBeTruthy();
    btn.click();
    expect(loadBlockedUsersSpy).toHaveBeenCalled();
  });

  it('shows empty state when there are no blocked users', () => {
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('safety.blockManagement.emptyTitle');
  });

  it('renders a list item for each blocked user', () => {
    blockedUsersSignal.set([user({ id: 'user-1' }), user({ id: 'user-2' })]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  it('displays the native and target languages separated by an arrow', () => {
    blockedUsersSignal.set([user()]);
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('li p.text-sm').textContent;
    expect(text).toContain('English');
    expect(text).toContain('\u2192');
    expect(text).toContain('French, German');
  });

  it('falls back to a placeholder avatar when no avatar_url is present', () => {
    blockedUsersSignal.set([user({ avatar_url: undefined })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('li img')).toBeNull();
    const avatarFallback = fixture.nativeElement.querySelector('li .bg-surface-2');
    expect(avatarFallback).toBeTruthy();
  });

  it('renders the avatar image when avatar_url is present', () => {
    blockedUsersSignal.set([user({ avatar_url: 'https://example.com/avatar.png' })]);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('li img');
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.png');
  });

  it('calls unblockUser with the correct id when the unblock button is clicked', () => {
    blockedUsersSignal.set([user({ id: 'user-42' })]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('li button');
    button.click();

    expect(unblockUserSpy).toHaveBeenCalledWith('user-42');
  });

  describe('hasTargetLanguages', () => {
    it('returns false when target_languages is undefined', () => {
      expect(component.hasTargetLanguages(user({ target_languages: undefined }))).toBe(false);
    });

    it('returns false when target_languages is empty', () => {
      expect(component.hasTargetLanguages(user({ target_languages: [] }))).toBe(false);
    });

    it('returns true when target_languages has entries', () => {
      expect(component.hasTargetLanguages(user({ target_languages: ['Spanish'] }))).toBe(true);
    });
  });

  describe('getTargetLanguagesText', () => {
    it('returns an empty string when target_languages is undefined', () => {
      expect(component.getTargetLanguagesText(user({ target_languages: undefined }))).toBe('');
    });

    it('joins target languages with a comma', () => {
      expect(
        component.getTargetLanguagesText(user({ target_languages: ['Spanish', 'Italian'] })),
      ).toBe('Spanish, Italian');
    });
  });
});
