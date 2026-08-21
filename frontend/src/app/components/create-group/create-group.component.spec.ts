import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CreateGroupComponent } from './create-group.component';
import { ChatService } from '../../services/chat.service';
import { DiscoveryService } from '../../services/discovery.service';
import { I18nService } from '../../services/i18n.service';

const mockUserA = {
  id: 'user-a',
  display_name: 'Alice',
  native_languages: ['English'],
  target_languages: ['French'],
  avatar_url: '',
  is_vip: false,
  vip_tier: '',
  coins_balance: 0,
  study_streak_days: 0,
  correction_ratio: 0,
  is_serious_learner: false,
  privacy_hide_age: false,
  privacy_hide_location: false,
  privacy_hide_from_search: false,
  privacy_hide_gender: false,
  created_at: '2026-01-01',
};

const mockUserB = {
  id: 'user-b',
  display_name: 'Bob',
  native_languages: ['French'],
  target_languages: ['English'],
  avatar_url: 'https://example.com/avatar.jpg',
  is_vip: false,
  vip_tier: '',
  coins_balance: 0,
  study_streak_days: 0,
  correction_ratio: 0,
  is_serious_learner: false,
  privacy_hide_age: false,
  privacy_hide_location: false,
  privacy_hide_from_search: false,
  privacy_hide_gender: false,
  created_at: '2026-01-02',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('CreateGroupComponent', () => {
  let component: CreateGroupComponent;
  let fixture: ComponentFixture<CreateGroupComponent>;
  let mockChatService: { createGroup: ReturnType<typeof vi.fn> };
  let mockDiscoveryService: { findPartners: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockChatService = {
      createGroup: vi.fn().mockResolvedValue({
        id: 'group-123',
        name: 'Test Group',
        created_at: '2026-01-01',
      }),
    };

    mockDiscoveryService = {
      findPartners: vi.fn().mockResolvedValue([mockUserA, mockUserB]),
    };

    await TestBed.configureTestingModule({
      imports: [CreateGroupComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        provideRouter([]),
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with empty state', () => {
    expect(component.groupName).toBe('');
    expect(component.selectedMembers().length).toBe(0);
    expect(component.isCreating()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.success()).toBe(false);
  });

  it('should add member to selected list', () => {
    component.addMember(mockUserA);
    expect(component.selectedMembers().length).toBe(1);
    expect(component.selectedMembers()[0].id).toBe('user-a');
  });

  it('should not add duplicate member', () => {
    component.addMember(mockUserA);
    component.addMember(mockUserA);
    expect(component.selectedMembers().length).toBe(1);
  });

  it('should remove member from selected list', () => {
    component.addMember(mockUserA);
    component.addMember(mockUserB);
    expect(component.selectedMembers().length).toBe(2);

    component.removeMember(mockUserA);
    expect(component.selectedMembers().length).toBe(1);
    expect(component.selectedMembers()[0].id).toBe('user-b');
  });

  it('should respect MAX_MEMBERS limit', () => {
    for (let i = 0; i < component.MAX_MEMBERS + 5; i++) {
      component.addMember({
        ...mockUserA,
        id: `user-${i}`,
        display_name: `User ${i}`,
      });
    }
    expect(component.selectedMembers().length).toBe(component.MAX_MEMBERS);
  });

  it('should compute selectedMemberIds', () => {
    component.addMember(mockUserA);
    component.addMember(mockUserB);
    expect(component.selectedMemberIds()).toEqual(['user-a', 'user-b']);
  });

  it('should not create group when name is empty', async () => {
    component.groupName = '';
    component.addMember(mockUserA);
    await component.createGroup();
    expect(mockChatService.createGroup).not.toHaveBeenCalled();
  });

  it('should not create group when no members selected', async () => {
    component.groupName = 'Test Group';
    await component.createGroup();
    expect(mockChatService.createGroup).not.toHaveBeenCalled();
  });

  it('should create group successfully', async () => {
    component.groupName = 'Test Group';
    component.addMember(mockUserA);

    await component.createGroup();
    expect(mockChatService.createGroup).toHaveBeenCalledWith('Test Group', ['user-a']);
    expect(component.success()).toBe(true);
  });

  it('should prevent duplicate create requests while one is pending', async () => {
    const pending = deferred<{ id: string; name: string; created_at: string }>();
    mockChatService.createGroup.mockReturnValueOnce(pending.promise);
    component.groupName = 'Test Group';
    component.addMember(mockUserA);

    const firstRequest = component.createGroup();
    const duplicateRequest = component.createGroup();
    fixture.detectChanges();

    const createButton: HTMLButtonElement = fixture.nativeElement.querySelector('.create-btn');
    expect(mockChatService.createGroup).toHaveBeenCalledTimes(1);
    expect(createButton.disabled).toBe(true);
    expect(createButton.getAttribute('aria-busy')).toBe('true');

    pending.resolve({
      id: 'group-123',
      name: 'Test Group',
      created_at: '2026-01-01',
    });
    await Promise.all([firstRequest, duplicateRequest]);
    fixture.detectChanges();

    expect(createButton.getAttribute('aria-busy')).toBe('false');
  });

  it('should handle create group error', async () => {
    mockChatService.createGroup.mockRejectedValue(new Error('Server error'));
    component.groupName = 'Test Group';
    component.addMember(mockUserA);

    await component.createGroup();
    expect(component.error()).not.toBeNull();
    expect(component.success()).toBe(false);
  });

  it('should clear search results when search query is empty', async () => {
    component.searchQuery = '';
    await component.searchUsers();
    expect(component.searchResults().length).toBe(0);
  });

  it('should filter search results by display name', async () => {
    component.searchQuery = 'Alice';

    await component.searchUsers();
    expect(component.searchResults().length).toBe(1);
    expect(component.searchResults()[0].id).toBe('user-a');
  });

  it('should ignore stale member-search responses', async () => {
    const firstResponse = deferred<(typeof mockUserA)[]>();
    mockDiscoveryService.findPartners
      .mockReturnValueOnce(firstResponse.promise)
      .mockResolvedValueOnce([mockUserB]);

    component.searchQuery = 'Alice';
    const firstSearch = component.searchUsers();

    component.searchQuery = 'Bob';
    const secondSearch = component.searchUsers();
    await secondSearch;

    expect(component.searchResults().map((user) => user.id)).toEqual(['user-b']);

    firstResponse.resolve([mockUserA]);
    await firstSearch;

    expect(component.searchResults().map((user) => user.id)).toEqual(['user-b']);
    expect(component.isSearching()).toBe(false);
  });

  it('should canAddMore return correct value', () => {
    expect(component.canAddMore()).toBe(true);

    for (let i = 0; i < 49; i++) {
      component.addMember({
        ...mockUserA,
        id: `user-${i}`,
        display_name: `User ${i}`,
      });
    }

    expect(component.canAddMore()).toBe(false);
  });

  it('should use native form semantics and an associated member-search label', () => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    const createButton: HTMLButtonElement = fixture.nativeElement.querySelector('.create-btn');
    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('#memberSearchInput');
    const searchLabel: HTMLLabelElement = fixture.nativeElement.querySelector(
      'label[for="memberSearchInput"]',
    );

    expect(form).toBeTruthy();
    expect(createButton.type).toBe('submit');
    expect(searchLabel.htmlFor).toBe('memberSearchInput');
    expect(searchInput.getAttribute('aria-label')).toBeNull();
    expect(searchInput.getAttribute('aria-busy')).toBe('false');
  });

  it('should keep member actions non-submit and disable result actions at the member limit', () => {
    for (let i = 0; i < component.MAX_MEMBERS; i++) {
      component.addMember({
        ...mockUserA,
        id: `user-${i}`,
        display_name: `User ${i}`,
      });
    }
    component.searchResults.set([mockUserB]);
    fixture.detectChanges();

    const resultButton: HTMLButtonElement = fixture.nativeElement.querySelector('.search-result-item');
    const removeButton: HTMLButtonElement = fixture.nativeElement.querySelector('.remove-btn');
    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('#memberSearchInput');

    expect(resultButton.type).toBe('button');
    expect(resultButton.disabled).toBe(true);
    expect(removeButton.type).toBe('button');
    expect(searchInput.disabled).toBe(true);
    expect(searchInput.getAttribute('aria-describedby')).toBe('memberSearchLimit');
  });

  it('should render the create button disabled when form is invalid', () => {
    const button = fixture.nativeElement.querySelector('.create-btn');
    expect(button.disabled).toBe(true);

    component.groupName = 'Test';
    component.addMember(mockUserA);
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });
});