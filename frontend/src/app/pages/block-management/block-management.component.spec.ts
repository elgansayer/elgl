import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import {
  BlockedUserResponse,
  BlockedUsersService,
} from '../../services/blocked-users.service';
import { BlockManagementComponent } from './block-management.component';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('BlockManagementComponent RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(
      resolve(__dirname, 'block-management.component.html'),
      'utf-8',
    );
  });

  it('does not contain physical direction CSS utilities', () => {
    const violations = [
      /\bpl-\d/,
      /\bpr-\d/,
      /\bml-\d/,
      /\bmr-\d/,
      /\bleft-[0-9]/,
      /\bright-[0-9]/,
      /\bborder-l\b/,
      /\bborder-r\b/,
      /\btext-left\b/,
      /\btext-right\b/,
    ];
    for (const pattern of violations) {
      expect(templateContent).not.toMatch(pattern);
    }
  });

  it('uses logical spacing and direction-safe language separation', () => {
    expect(templateContent).toContain('ps-4');
    expect(templateContent).toContain('pe-4');
    expect(templateContent).toContain('ms-1 me-1');
    expect(templateContent).not.toContain('→');
  });

  it('uses i18n keys for user-facing state', () => {
    const keys = [
      "'safety.blockManagement.title'",
      "'safety.blockManagement.loadError'",
      "'safety.blockManagement.loadErrorDesc'",
      "'safety.blockManagement.emptyTitle'",
      "'safety.blockManagement.emptyDesc'",
      "'safety.blockManagement.unblock'",
      "'common.error_generic'",
    ];
    for (const key of keys) {
      expect(templateContent).toContain(key);
    }
  });

  it('uses a labelled main region and touch-sized Spartan unblock action', () => {
    expect(templateContent).toContain('<main');
    expect(templateContent).toContain('aria-labelledby="block-management-title"');
    expect(templateContent).toContain('variant="destructive"');
    expect(templateContent).toContain('size="touch"');
    expect(templateContent).toContain('[attr.aria-busy]');
  });
});

describe('BlockManagementComponent', () => {
  let component: BlockManagementComponent;
  let fixture: ComponentFixture<BlockManagementComponent>;
  let blockedUsersSignal: ReturnType<typeof signal<BlockedUserResponse[]>>;
  let loadingSignal: ReturnType<typeof signal<boolean>>;
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let unblockingUserIdsSignal: ReturnType<typeof signal<ReadonlySet<string>>>;
  let unblockErrorSignal: ReturnType<typeof signal<boolean>>;
  let unblockUserSpy: ReturnType<typeof vi.fn>;
  let loadBlockedUsersSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;

  const mockI18nService = {
    translate: (key: string, params?: Record<string, unknown>) =>
      params?.['name'] ? `${key}:${String(params['name'])}` : key,
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
    unblockingUserIdsSignal = signal<ReadonlySet<string>>(new Set());
    unblockErrorSignal = signal<boolean>(false);
    unblockUserSpy = vi.fn().mockResolvedValue(true);
    loadBlockedUsersSpy = vi.fn().mockResolvedValue(undefined);
    confirmSpy = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [BlockManagementComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ConfirmService, useValue: { confirm: confirmSpy } },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers: blockedUsersSignal.asReadonly(),
            isLoading: loadingSignal.asReadonly(),
            error: errorSignal.asReadonly(),
            unblockingUserIds: unblockingUserIdsSignal.asReadonly(),
            unblockError: unblockErrorSignal.asReadonly(),
            unblockUser: unblockUserSpy,
            loadBlockedUsers: loadBlockedUsersSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockManagementComponent);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows skeleton loaders while loading', () => {
    loadingSignal.set(true);
    fixture.detectChanges();

    const skeletonEls = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletonEls.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows a retry action when loading fails', () => {
    errorSignal.set('Failed to load blocked users');
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    const button = emptyState.querySelector('button');
    expect(button).toBeTruthy();
    button.click();
    expect(loadBlockedUsersSpy).toHaveBeenCalledOnce();
  });

  it('shows an honest empty state when there are no blocked users', () => {
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('safety.blockManagement.emptyTitle');
  });

  it('renders blocked-user identity and language metadata without a directional arrow', () => {
    blockedUsersSignal.set([user()]);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('li');
    expect(item.textContent).toContain('Ada Lovelace');
    expect(item.textContent).toContain('English');
    expect(item.textContent).toContain('French, German');
    expect(item.textContent).not.toContain('→');
  });

  it('uses a decorative avatar when the adjacent display name already labels the user', () => {
    blockedUsersSignal.set([user({ avatar_url: 'https://example.com/avatar.png' })]);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('li img');
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('asks for confirmation before unblocking a user', async () => {
    blockedUsersSignal.set([user({ id: 'user-42' })]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('li button').click();
    await fixture.whenStable();

    expect(confirmSpy).toHaveBeenCalledWith(
      'safety.blockManagement.unblockAria:Ada Lovelace',
    );
    expect(unblockUserSpy).toHaveBeenCalledWith('user-42');
  });

  it('does not unblock when confirmation is cancelled', async () => {
    confirmSpy.mockResolvedValue(false);
    blockedUsersSignal.set([user()]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('li button').click();
    await fixture.whenStable();

    expect(unblockUserSpy).not.toHaveBeenCalled();
  });

  it('disables an unblock action while that user mutation is pending', () => {
    blockedUsersSignal.set([user({ id: 'user-42' })]);
    unblockingUserIdsSignal.set(new Set(['user-42']));
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('li button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('announces unblock failures without removing the current list', () => {
    blockedUsersSignal.set([user()]);
    unblockErrorSignal.set(true);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('common.error_generic');
    expect(fixture.nativeElement.querySelectorAll('li')).toHaveLength(1);
  });

  describe('language helpers', () => {
    it('handles missing and empty target language lists', () => {
      expect(component.hasTargetLanguages(user({ target_languages: undefined }))).toBe(false);
      expect(component.hasTargetLanguages(user({ target_languages: [] }))).toBe(false);
      expect(component.getTargetLanguagesText(user({ target_languages: undefined }))).toBe('');
    });

    it('joins target languages for display', () => {
      expect(
        component.getTargetLanguagesText(user({ target_languages: ['Spanish', 'Italian'] })),
      ).toBe('Spanish, Italian');
    });
  });
});
