import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Location } from '@angular/common';
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

describe('BlockManagementComponent template contract', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(
      resolve(__dirname, 'block-management.component.html'),
      'utf-8',
    );
  });

  it('uses logical direction utilities and translated user-facing copy', () => {
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
    for (const pattern of violations) expect(templateContent).not.toMatch(pattern);

    expect(templateContent).toContain('ps-4');
    expect(templateContent).toContain('pe-4');
    expect(templateContent).toContain("'safety.blockManagement.title'");
    expect(templateContent).toContain("'safety.blockManagement.unblock'");
    expect(templateContent).toContain("'common.cancel'");
    expect(templateContent).not.toMatch(/>\s*Blocked Users\s*</);
    expect(templateContent).not.toMatch(/>\s*Unblock\s*</);
  });

  it('provides semantic list, status, busy and high-zoom wrapping affordances', () => {
    expect(templateContent).toContain('role="list"');
    expect(templateContent).toContain('role="listitem"');
    expect(templateContent).toContain('aria-live="assertive"');
    expect(templateContent).toContain('[attr.aria-busy]="isUnblocking(user.id)"');
    expect(templateContent).toContain('flex-col');
    expect(templateContent).toContain('break-words');
    expect(templateContent).toContain('dir="auto"');
  });
});

describe('BlockManagementComponent', () => {
  let component: BlockManagementComponent;
  let fixture: ComponentFixture<BlockManagementComponent>;
  let blockedUsersSignal: ReturnType<typeof signal<BlockedUserResponse[]>>;
  let loadingSignal: ReturnType<typeof signal<boolean>>;
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let unblockErrorSignal: ReturnType<typeof signal<string | null>>;
  let pendingIds: Set<string>;
  let unblockUserSpy: ReturnType<typeof vi.fn>;
  let loadBlockedUsersSpy: ReturnType<typeof vi.fn>;
  let clearUnblockErrorSpy: ReturnType<typeof vi.fn>;
  let goBackSpy: ReturnType<typeof vi.fn>;

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
    loadingSignal = signal(false);
    errorSignal = signal<string | null>(null);
    unblockErrorSignal = signal<string | null>(null);
    pendingIds = new Set<string>();
    unblockUserSpy = vi.fn().mockResolvedValue(undefined);
    loadBlockedUsersSpy = vi.fn().mockResolvedValue(undefined);
    clearUnblockErrorSpy = vi.fn(() => unblockErrorSignal.set(null));
    goBackSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [BlockManagementComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: Location, useValue: { back: goBackSpy } },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers: blockedUsersSignal.asReadonly(),
            isLoading: loadingSignal.asReadonly(),
            error: errorSignal.asReadonly(),
            unblockError: unblockErrorSignal.asReadonly(),
            pendingUnblocks: signal<ReadonlySet<string>>(new Set()).asReadonly(),
            isUnblocking: (id: string) => pendingIds.has(id),
            unblockUser: unblockUserSpy,
            loadBlockedUsers: loadBlockedUsersSpy,
            clearUnblockError: clearUnblockErrorSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockManagementComponent);
    component = fixture.componentInstance;
  });

  it('creates and renders empty state', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('shows loading skeletons and a retryable empty-page load failure', () => {
    loadingSignal.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-skeleton-loader').length).toBeGreaterThan(0);

    loadingSignal.set(false);
    errorSignal.set('failed');
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    emptyState.querySelector('button').click();
    expect(loadBlockedUsersSpy).toHaveBeenCalledTimes(1);
  });

  it('retains stale rows during a refresh failure and exposes retry', () => {
    blockedUsersSignal.set([user()]);
    errorSignal.set('failed');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('li')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders safe user details and language context', () => {
    blockedUsersSignal.set([
      user({ avatar_url: 'https://example.com/avatar.png' }),
      user({ id: 'user-2', display_name: 'Lin', avatar_url: undefined, target_languages: [] }),
    ]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('img').getAttribute('src')).toBe('https://example.com/avatar.png');
    expect(items[0].textContent).toContain('English');
    expect(items[0].textContent).toContain('French, German');
    expect(items[1].querySelector('img')).toBeNull();
  });

  it('requires a confirmation step before calling the unblock API', () => {
    blockedUsersSignal.set([user({ id: 'user-42' })]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('li button').click();
    fixture.detectChanges();

    expect(component.confirmUnblockId()).toBe('user-42');
    expect(unblockUserSpy).not.toHaveBeenCalled();
    expect(clearUnblockErrorSpy).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('li button')).toHaveLength(2);
  });

  it('cancels without unblocking', () => {
    component.requestUnblock('user-42');
    component.cancelUnblock();

    expect(component.confirmUnblockId()).toBeNull();
    expect(unblockUserSpy).not.toHaveBeenCalled();
  });

  it('unblocks after confirmation and closes the confirmation state', async () => {
    component.requestUnblock('user-42');
    await component.confirmUnblock('user-42');

    expect(unblockUserSpy).toHaveBeenCalledWith('user-42');
    expect(component.confirmUnblockId()).toBeNull();
  });

  it('keeps confirmation available for retry after an unblock failure', async () => {
    unblockUserSpy.mockRejectedValueOnce(new Error('network'));
    component.requestUnblock('user-42');

    await component.confirmUnblock('user-42');

    expect(component.confirmUnblockId()).toBe('user-42');
  });

  it('suppresses duplicate unblock attempts while one is pending', async () => {
    pendingIds.add('user-42');
    component.requestUnblock('user-42');
    expect(component.confirmUnblockId()).toBeNull();

    component.confirmUnblockId.set('user-42');
    await component.confirmUnblock('user-42');
    expect(unblockUserSpy).not.toHaveBeenCalled();
  });

  it('navigates back to privacy settings history', () => {
    component.goBack();
    expect(goBackSpy).toHaveBeenCalledTimes(1);
  });
});
