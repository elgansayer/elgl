import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatListComponent } from './chat-list.component';
import { ChatService } from '../../services/chat.service';
import { ChatFolderService } from '../../services/chat-folder.service';
import { GroupsService } from '../../services/groups.service';
import { AuthService } from '../../services/auth.service';
import { UnreadCounterService } from '../../services/unread-counter.service';
import * as toast from '../../services/toast.service';
import { provideRouter } from '@angular/router';

const room = (id: string, title = id) => ({
  id,
  title,
  subtitle: '',
  avatar: '',
  is_online: false,
  is_pinned: false,
  created_at: '2026-08-23T00:00:00Z',
});

describe('ChatListComponent', () => {
  let component: ChatListComponent;
  let fixture: ComponentFixture<ChatListComponent>;
  let mockChatService: {
    getRooms: ReturnType<typeof vi.fn>;
    getRecentChats: ReturnType<typeof vi.fn>;
    getLabels: ReturnType<typeof vi.fn>;
    getLockedRoomIds: ReturnType<typeof vi.fn>;
    lockChat: ReturnType<typeof vi.fn>;
    unlockChat: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
  };
  let mockChatFolderService: {
    getArchivedRooms: ReturnType<typeof vi.fn>;
    getHiddenRooms: ReturnType<typeof vi.fn>;
    archiveRoom: ReturnType<typeof vi.fn>;
    unarchiveRoom: ReturnType<typeof vi.fn>;
  };
  let mockGroupsService: {
    getDiscoverableGroups: ReturnType<typeof vi.fn>;
    joinGroup: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof vi.fn>;
    unlockApp: ReturnType<typeof vi.fn>;
    appLocked: ReturnType<typeof vi.fn>;
    getAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getRecentChats: vi.fn().mockResolvedValue([]),
      getLabels: vi.fn().mockResolvedValue([]),
      getLockedRoomIds: vi.fn().mockResolvedValue([]),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
      getMessages: vi.fn().mockResolvedValue([]),
    };
    mockChatFolderService = {
      getArchivedRooms: vi.fn().mockResolvedValue([]),
      getHiddenRooms: vi.fn().mockResolvedValue([]),
      archiveRoom: vi.fn().mockResolvedValue(undefined),
      unarchiveRoom: vi.fn().mockResolvedValue(undefined),
    };
    mockGroupsService = {
      getDiscoverableGroups: vi.fn().mockResolvedValue([]),
      joinGroup: vi.fn().mockResolvedValue({ success: true }),
    };
    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ id: 'user-1' }),
      unlockApp: vi.fn().mockResolvedValue(undefined),
      appLocked: vi.fn().mockReturnValue(false),
      getAccessToken: vi.fn().mockReturnValue('token'),
    };

    await TestBed.configureTestingModule({
      imports: [ChatListComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ChatFolderService, useValue: mockChatFolderService },
        { provide: GroupsService, useValue: mockGroupsService },
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: UnreadCounterService,
          useValue: { setChatUnread: vi.fn() },
        },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and default to chats tab', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab()).toBe('chats');
  });

  it('should switch to groups tab and load groups only when needed', async () => {
    const groups = [
      {
        id: 'g1',
        name: 'Spanish Learners',
        owner_id: 'u1',
        max_members: 10,
        member_count: 5,
        is_member: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    mockGroupsService.getDiscoverableGroups.mockResolvedValue(groups);

    component.switchTab('groups');
    await fixture.whenStable();
    expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalledTimes(1);

    component.groups.set(groups);
    mockGroupsService.getDiscoverableGroups.mockClear();
    component.switchTab('groups');
    expect(mockGroupsService.getDiscoverableGroups).not.toHaveBeenCalled();
  });

  it('should handle join group', async () => {
    await component.handleJoinGroup('g1');
    expect(mockGroupsService.joinGroup).toHaveBeenCalledWith('g1');
    expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalled();
  });

  it('notImplemented should show toast', () => {
    component.notImplemented();
    expect(toast.toastsSignal().length).toBeGreaterThan(0);
  });

  it('loads archived room details and keeps them out of the normal inbox', async () => {
    mockChatService.getRooms.mockResolvedValue([room('room-active')]);
    mockChatFolderService.getArchivedRooms.mockResolvedValue([room('room-archived')]);

    await component.loadPreviews();
    await (component as unknown as { loadArchivedRooms(): Promise<void> }).loadArchivedRooms();

    expect(component.archivedRoomIds()).toEqual(['room-archived']);
    expect(component.regularAndPinnedPreviews().map((preview) => preview.id)).toEqual([
      'room-active',
    ]);
    expect(component.archivedPreviews().map((preview) => preview.id)).toEqual([
      'room-archived',
    ]);
  });

  it('archives server-first and does not change folder state when persistence fails', async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;
    mockChatFolderService.archiveRoom.mockRejectedValueOnce(new Error('unavailable'));

    await component.toggleRoomArchive(event, 'room-1');

    expect(mockChatFolderService.archiveRoom).toHaveBeenCalledWith('room-1');
    expect(component.archivedRoomIds()).toEqual([]);
    expect(toast.toastsSignal().some((entry) => entry.type === 'error')).toBe(true);
  });

  it('archives and unarchives an existing room idempotently', async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

    await component.toggleRoomArchive(event, 'room-1');
    expect(component.archivedRoomIds()).toEqual(['room-1']);

    await component.toggleRoomArchive(event, 'room-1');
    expect(mockChatFolderService.unarchiveRoom).toHaveBeenCalledWith('room-1');
    expect(component.archivedRoomIds()).toEqual([]);
  });

  it('does not request hidden room details until local app unlock succeeds', async () => {
    component.lockedRoomIds.set(['hidden-room']);
    mockAuthService.appLocked.mockReturnValue(true);

    await component.toggleLockedFolder();

    expect(mockAuthService.unlockApp).toHaveBeenCalled();
    expect(mockChatFolderService.getHiddenRooms).not.toHaveBeenCalled();
    expect(component.showLocked()).toBe(false);
  });

  it('loads hidden room details only after unlock and reveals the hidden folder', async () => {
    component.lockedRoomIds.set(['hidden-room']);
    mockChatFolderService.getHiddenRooms.mockResolvedValue([room('hidden-room', 'Hidden')]);

    await component.toggleLockedFolder();

    expect(mockChatFolderService.getHiddenRooms).toHaveBeenCalledTimes(1);
    expect(component.showLocked()).toBe(true);
    expect(component.lockedPreviews().map((preview) => preview.id)).toEqual(['hidden-room']);
  });

  describe('toggleRoomLock', () => {
    it('locks an unlocked chat and adds it to lockedRoomIds', async () => {
      component.lockedRoomIds.set([]);
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(mockChatService.lockChat).toHaveBeenCalledWith('room-1');
      expect(component.lockedRoomIds()).toEqual(['room-1']);
      expect(component.isRoomLocked('room-1')).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('unlocks a locked chat and removes it from lockedRoomIds', async () => {
      component.lockedRoomIds.set(['room-1']);
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(mockChatService.unlockChat).toHaveBeenCalledWith('room-1');
      expect(component.lockedRoomIds()).toEqual([]);
    });

    it('keeps state unchanged when the lock request fails', async () => {
      mockChatService.lockChat.mockRejectedValueOnce(new Error('network error'));
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(component.lockedRoomIds()).toEqual([]);
      expect(toast.toastsSignal().some((entry) => entry.type === 'error')).toBe(true);
    });
  });
});
