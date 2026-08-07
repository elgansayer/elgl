import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminBlocksComponent } from './admin-blocks.component';
import { AdminBlockedUser, AdminService } from '../../../services/admin.service';
import { I18nService } from '../../../services/i18n.service';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('AdminBlocksComponent RTL logical CSS compliance', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(
      resolve(__dirname, 'admin-blocks.component.html'),
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

  it('should use logical gap utilities for inline spacing', () => {
    expect(templateContent).toContain('gap-3');
  });

  it('should use i18n translate pipe for all user-facing strings', () => {
    const keys = [
      "'admin.blocks.title'",
      "'admin.blocks.loadError'",
      "'admin.blocks.loadErrorDesc'",
      "'admin.blocks.emptyTitle'",
      "'admin.blocks.emptyDesc'",
      "'admin.blocks.unblock'",
      "'common.retry'",
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
    expect(withoutI18n).not.toMatch(/Blocked Users/i);
    expect(withoutI18n).not.toMatch(/\bUnblock\b/);
    expect(withoutI18n).not.toMatch(/Failed to load/i);
    expect(withoutI18n).not.toMatch(/No blocked users/i);
  });
});

describe('AdminBlocksComponent', () => {
  let component: AdminBlocksComponent;
  let fixture: ComponentFixture<AdminBlocksComponent>;
  let listBlockedUsersSpy: ReturnType<typeof vi.fn>;
  let adminUnblockUserSpy: ReturnType<typeof vi.fn>;

  const mockI18nService = {
    translate: (key: string) => key,
  };

  const createUser = (overrides: Partial<AdminBlockedUser> = {}): AdminBlockedUser => ({
    id: 'user-1',
    display_name: 'John Doe',
    native_language: 'English',
    target_languages: ['French', 'Spanish'],
    ...overrides,
  });

  beforeEach(async () => {
    listBlockedUsersSpy = vi.fn().mockResolvedValue([]);
    adminUnblockUserSpy = vi.fn().mockResolvedValue({ message: 'User unblocked' });

    await TestBed.configureTestingModule({
      imports: [AdminBlocksComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: AdminService,
          useValue: {
            listBlockedUsers: listBlockedUsersSpy,
            adminUnblockUser: adminUnblockUserSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBlocksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows skeleton loaders when loading', async () => {
    listBlockedUsersSpy.mockReturnValue(new Promise(() => {})); // never resolves
    fixture.detectChanges();

    const skeletonEls = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletonEls.length).toBeGreaterThan(0);

    const title = fixture.nativeElement.querySelector('h1');
    expect(title.textContent).toContain('admin.blocks.title');
  });

  it('shows error empty state when load fails', async () => {
    listBlockedUsersSpy.mockRejectedValue(new Error('fail'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('admin.blocks.loadError');
  });

  it('shows empty state when there are no blocked users', async () => {
    listBlockedUsersSpy.mockResolvedValue([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('admin.blocks.emptyTitle');
  });

  it('renders a list item for each blocked user', async () => {
    listBlockedUsersSpy.mockResolvedValue([
      createUser({ id: 'user-a' }),
      createUser({ id: 'user-b', display_name: 'Jane' }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li');
    expect(items.length).toBe(2);
  });

  it('displays display_name and language info for each blocked user', async () => {
    listBlockedUsersSpy.mockResolvedValue([
      createUser({ id: 'user-a', display_name: 'Alice', native_language: 'Korean', target_languages: ['English'] }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.querySelector('li p.text-sm')?.textContent ?? '';
    expect(text).toContain('Korean');
    expect(text).toContain('\u2192');
    expect(text).toContain('English');

    const name = fixture.nativeElement.querySelector('li p.font-medium')?.textContent ?? '';
    expect(name).toContain('Alice');
  });

  it('renders avatar image when avatar_url is present', async () => {
    listBlockedUsersSpy.mockResolvedValue([
      createUser({ id: 'user-x', avatar_url: 'https://example.com/pic.png' }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('li img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/pic.png');
  });

  it('renders fallback avatar circle when avatar_url is absent', async () => {
    listBlockedUsersSpy.mockResolvedValue([
      createUser({ id: 'user-nopic', avatar_url: undefined }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('li img')).toBeNull();
    const fallback = fixture.nativeElement.querySelector('li .bg-surface-2');
    expect(fallback).toBeTruthy();
  });

  it('calls adminUnblockUser when unblock button is clicked', async () => {
    listBlockedUsersSpy.mockResolvedValue([createUser({ id: 'user-42' })]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('li button');
    button.click();

    expect(adminUnblockUserSpy).toHaveBeenCalledWith('user-42');
  });

  it('retry button triggers refresh', async () => {
    listBlockedUsersSpy.mockRejectedValue(new Error('fail'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Click retry on the error empty-state
    listBlockedUsersSpy.mockResolvedValue([createUser({ id: 'fresh' })]);
    const retryBtn = fixture.nativeElement.querySelector('app-empty-state button');
    expect(retryBtn).toBeTruthy();
    retryBtn.click();

    await fixture.whenStable();
    fixture.detectChanges();
    expect(listBlockedUsersSpy).toHaveBeenCalledTimes(2); // initial + retry
  });
});