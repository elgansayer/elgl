import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { BlockManagementComponent } from './block-management.component';
import {
  BlockedUserResponse,
  BlockedUsersService,
} from '../../services/blocked-users.service';
import { I18nService } from '../../services/i18n.service';

describe('BlockManagementComponent', () => {
  let component: BlockManagementComponent;
  let fixture: ComponentFixture<BlockManagementComponent>;
  let blockedUsersSignal: ReturnType<typeof signal<BlockedUserResponse[]>>;
  let unblockUserSpy: ReturnType<typeof vi.fn>;

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
    unblockUserSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [BlockManagementComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: BlockedUsersService,
          useValue: {
            blockedUsers: blockedUsersSignal.asReadonly(),
            unblockUser: unblockUserSpy,
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

  it('shows the empty state when there are no blocked users', () => {
    fixture.detectChanges();

    const emptyMessage = fixture.nativeElement.querySelector('p');
    expect(emptyMessage.textContent).toContain('blockManagement.noBlockedUsers');
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(0);
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
    expect(text).toContain('→');
    expect(text).toContain('French, German');
  });

  it('falls back to a placeholder avatar when no avatar_url is present', () => {
    blockedUsersSignal.set([user({ avatar_url: undefined })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('li img')).toBeNull();
    expect(fixture.nativeElement.querySelector('li div.bg-surface-2')).toBeTruthy();
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
