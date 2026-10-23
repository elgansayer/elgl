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

  it('should respect the 50-member selection limit', () => {
    expect(component.MAX_MEMBERS).toBe(50);

    for (let i = 0; i < component.MAX_MEMBERS + 5; i++) {
      component.addMember({
        ...mockUserA,
        id: `user-${i}`,
        display_name: `User ${i}`,
      });
    }
    expect(component.selectedMembers().length).toBe(50);
  });

  it('should submit all 50 selected member ids', async () => {
    component.groupName = 'Fifty Member Group';
    const expectedIds: string[] = [];

    for (let i = 0; i < component.MAX_MEMBERS; i++) {
      const id = `member-${i}`;
      expectedIds.push(id);
      component.addMember({
        ...mockUserA,
        id,
        display_name: `Member ${i}`,
      });
    }

    await component.createGroup();

    expect(component.selectedCount()).toBe(50);
    expect(component.canAddMore()).toBe(false);
    expect(mockChatService.createGroup).toHaveBeenCalledWith('Fifty Member Group', expectedIds);
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
    expect(component.MAX_MEMBERS).toBe(50);
    expect(component.canAddMore()).toBe(true);

    for (let i = 0; i < component.MAX_MEMBERS; i++) {
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
    expect(form.getAttribute('aria-labelledby')).toBe('createGroupTitle');
    expect(createButton.type).toBe('submit');
    expect(searchLabel.id).toBe('memberSearchLabel');
    expect(searchLabel.htmlFor).toBe('memberSearchInput');
    expect(searchInput.getAttribute('aria-label')).toBeNull();
    expect(searchInput.getAttribute('aria-busy')).toBe('false');
  });

  it('should expose bidirectional text inputs without changing page direction', () => {
    const groupNameInput: HTMLInputElement = fixture.nativeElement.querySelector('#groupNameInput');
    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('#memberSearchInput');

    expect(groupNameInput.getAttribute('dir')).toBe('auto');
    expect(searchInput.getAttribute('dir')).toBe('auto');
  });

  it('should render search results as a labelled semantic list', () => {
    component.searchResults.set([mockUserA]);
    fixture.detectChanges();

    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('#memberSearchInput');
    const results: HTMLUListElement = fixture.nativeElement.querySelector('#memberSearchResults');
    const row: HTMLLIElement = results.querySelector('.search-result-row')!;
    const addButton: HTMLButtonElement = row.querySelector('.search-result-item')!;
    const actionText: HTMLElement = addButton.querySelector('.sr-only')!;

    expect(results.tagName).toBe('UL');
    expect(results.getAttribute('aria-labelledby')).toBe('memberSearchLabel');
    expect(row.tagName).toBe('LI');
    expect(searchInput.getAttribute('aria-controls')).toBe('memberSearchResults');
    expect(actionText.textContent?.trim()).not.toBe('');
    expect(addButton.getAttribute('aria-label')).toBeNull();
  });

  it('should return focus to member search after adding a search result', () => {
    component.searchResults.set([mockUserA]);
    fixture.detectChanges();

    const searchInput: HTMLInputElement = fixture.nativeElement.querySelector('#memberSearchInput');
    const resultButton: HTMLButtonElement = fixture.nativeElement.querySelector('.search-result-item');
    resultButton.focus();
    resultButton.click();
    fixture.detectChanges();

    expect(component.selectedMemberIds()).toContain('user-a');
    expect(document.activeElement).toBe(searchInput);
  });

  it('should move focus to group name when adding the final allowed member', () => {
    for (let i = 0; i < component.MAX_MEMBERS - 1; i++) {
      component.addMember({
        ...mockUserA,
        id: `limit-user-${i}`,
        display_name: `Limit User ${i}`,
      });
    }
    component.searchResults.set([mockUserB]);
    fixture.detectChanges();

    const groupNameInput: HTMLInputElement = fixture.nativeElement.querySelector('#groupNameInput');
    const resultButton: HTMLButtonElement = fixture.nativeElement.querySelector('.search-result-item');
    resultButton.focus();
    resultButton.click();
    fixture.detectChanges();

    expect(component.selectedCount()).toBe(component.MAX_MEMBERS);
    expect(component.canAddMore()).toBe(false);
    expect(document.activeElement).toBe(groupNameInput);
  });

  it('should preserve focus on an adjacent remove action when a member is removed', () => {
    component.addMember(mockUserA);
    component.addMember(mockUserB);
    fixture.detectChanges();

    const removeButtons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.remove-btn'),
    );
    removeButtons[0].focus();
    removeButtons[0].click();
    fixture.detectChanges();

    const remainingRemoveButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.remove-btn');
    expect(component.selectedMemberIds()).toEqual(['user-b']);
    expect(document.activeElement).toBe(remainingRemoveButton);
  });

  it('should announce selected-member count changes and label the selected list', () => {
    component.addMember(mockUserA);
    fixture.detectChanges();

    const heading: HTMLElement = fixture.nativeElement.querySelector('#selectedMembersHeading');
    const list: HTMLUListElement = fixture.nativeElement.querySelector('.selected-list');

    expect(heading.getAttribute('aria-live')).toBe('polite');
    expect(heading.getAttribute('aria-atomic')).toBe('true');
    expect(list.getAttribute('aria-labelledby')).toBe('selectedMembersHeading');
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

  it('should associate create failures with the submit action', async () => {
    mockChatService.createGroup.mockRejectedValue(new Error('Server error'));
    component.groupName = 'Test Group';
    component.addMember(mockUserA);

    await component.createGroup();
    fixture.detectChanges();

    const createButton: HTMLButtonElement = fixture.nativeElement.querySelector('.create-btn');
    const error: HTMLElement = fixture.nativeElement.querySelector('#createGroupError');
    expect(error.getAttribute('role')).toBe('alert');
    expect(createButton.getAttribute('aria-describedby')).toBe('createGroupError');
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
