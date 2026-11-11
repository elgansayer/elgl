import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupProfileComponent } from './group-profile.component';
import { GroupsService } from '../../services/groups.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

const info = {
  id: 'group-1',
  name: 'London Language Exchange',
  owner_id: 'user-1',
  max_members: 20,
  interest_id: 'interest-1',
  community_id: null,
  interest: { name: 'Languages' },
};

const members = [
  { user_id: 'user-1', user: { id: 'user-1', display_name: 'Owner', avatar_url: null } },
  { user_id: 'user-2', user: { id: 'user-2', display_name: 'Member Two', avatar_url: null } },
];

const announcements = [
  { id: 'a1', message: 'Meetup on Friday', createdAt: '2026-11-01T10:00:00Z', senderId: 'user-1' },
];

const settings = {
  can_send_messages: true,
  can_edit_info: false,
  description: 'Practise languages together',
  rules: 'Be kind',
  interest_id: 'interest-1',
  max_members: 20,
};

describe('GroupProfileComponent', () => {
  let fixture: ComponentFixture<GroupProfileComponent>;
  let groupsService: {
    getGroupInfo: ReturnType<typeof vi.fn>;
    getGroupMembers: ReturnType<typeof vi.fn>;
    getAnnouncements: ReturnType<typeof vi.fn>;
    getGroupSettings: ReturnType<typeof vi.fn>;
    joinGroup: ReturnType<typeof vi.fn>;
    openGroupChat: ReturnType<typeof vi.fn>;
    sendAnnouncement: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let currentUser = signal<{ id: string; user_metadata: Record<string, string> } | null>({
    id: 'user-2',
    user_metadata: { display_name: 'Member Two' },
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    fixture.detectChanges();
  }

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GroupProfileComponent],
      providers: [
        provideRouter([]),
        { provide: GroupsService, useValue: groupsService },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (name: string) => (name === 'groupId' ? 'group-1' : null) } },
          },
        },
        { provide: Router, useValue: router },
        { provide: TranslatePipe, useValue: { transform: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GroupProfileComponent);
    await settle();
  }

  beforeEach(() => {
    currentUser = signal({
      id: 'user-2',
      user_metadata: { display_name: 'Member Two' },
    });
    groupsService = {
      getGroupInfo: vi.fn().mockResolvedValue(info),
      getGroupMembers: vi.fn().mockResolvedValue(members),
      getAnnouncements: vi.fn().mockResolvedValue(announcements),
      getGroupSettings: vi.fn().mockResolvedValue(settings),
      joinGroup: vi.fn().mockResolvedValue({ success: true }),
      openGroupChat: vi.fn().mockResolvedValue({ roomId: 'room-9' }),
      sendAnnouncement: vi.fn().mockResolvedValue({ success: true }),
      removeMember: vi.fn().mockResolvedValue(undefined),
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };
  });

  it('renders the group landing page with the member roster', async () => {
    await create();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('London Language Exchange');
    expect(text).toContain('Owner');
    expect(text).toContain('Member Two');
    expect(text).toContain('Meetup on Friday');
    expect(text).toContain('Practise languages together');
  });

  it('routes a member into the linked group chat', async () => {
    await create();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const openButton = buttons.find((button) =>
      button.textContent?.includes('Open group chat'),
    );
    expect(openButton).toBeTruthy();

    openButton!.click();
    await settle();

    expect(groupsService.openGroupChat).toHaveBeenCalledWith('group-1');
    expect(router.navigate).toHaveBeenCalledWith(['/chat', 'room-9']);
  });

  it('lets a non-member join from the landing page', async () => {
    currentUser.set({ id: 'user-9', user_metadata: { display_name: 'New User' } });
    await create();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const joinButton = buttons.find((button) =>
      button.textContent?.includes('Join group'),
    );
    expect(joinButton).toBeTruthy();

    joinButton!.click();
    await settle();

    expect(groupsService.joinGroup).toHaveBeenCalledWith('group-1');
  });

  it('lets an admin post an announcement', async () => {
    currentUser.set({ id: 'user-1', user_metadata: { display_name: 'Owner' } });
    await create();

    const textarea = fixture.nativeElement.querySelector('#groupAnnouncementInput') as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea!.getAttribute('aria-describedby')).toBe('groupAnnouncementHint');
    expect(fixture.nativeElement.querySelector('#groupAnnouncementHint')).not.toBeNull();
    textarea!.value = 'New announcement';
    textarea!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const postButton = buttons.find((button) =>
      button.textContent?.includes('Post announcement'),
    );
    postButton!.click();
    await settle();

    expect(groupsService.sendAnnouncement).toHaveBeenCalledWith('group-1', 'New announcement');
  });

  it('shows an accessible retry state when the group cannot be loaded', async () => {
    groupsService.getGroupInfo.mockRejectedValue(new Error('not found'));
    await create();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
