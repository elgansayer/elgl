import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatListComponent } from './chat-list.component';
import { ChatService } from '../../services/chat.service';
import { GroupsService } from '../../services/groups.service';
import * as toast from '../../services/toast.service';
import { provideRouter } from '@angular/router';

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
  let mockGroupsService: {
    getDiscoverableGroups: ReturnType<typeof vi.fn>;
    joinGroup: ReturnType<typeof vi.fn>;
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

    mockGroupsService = {
      getDiscoverableGroups: vi.fn().mockResolvedValue([]),
      joinGroup: vi.fn().mockResolvedValue({ success: true }),
    };

    await TestBed.configureTestingModule({
      imports: [ChatListComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: GroupsService, useValue: mockGroupsService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to chats tab', () => {
    expect(component.activeTab()).toBe('chats');
  });

  it('should switch to groups tab and load groups', async () => {
    const mockGroups = [
      { id: 'g1', name: 'Spanish Learners', owner_id: 'u1', max_members: 10, member_count: 5, is_member: false, created_at: '2026-01-01T00:00:00Z' },
    ];
    mockGroupsService.getDiscoverableGroups.mockResolvedValue(mockGroups);

    component.switchTab('groups');
    await fixture.whenStable();

    expect(component.activeTab()).toBe('groups');
    expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalled();
  });

  it('should not reload groups on switchTab if already loaded', async () => {
    const mockGroups = [
      { id: 'g1', name: 'Spanish Learners', owner_id: 'u1', max_members: 10, member_count: 5, is_member: false, created_at: '2026-01-01T00:00:00Z' },
    ];
    component.groups.set(mockGroups);

    component.switchTab('groups');
    await fixture.whenStable();

    expect(component.activeTab()).toBe('groups');
    expect(mockGroupsService.getDiscoverableGroups).not.toHaveBeenCalled();
  });

  it('should handle join group', async () => {
    const mockGroups = [
      { id: 'g1', name: 'Spanish Learners', owner_id: 'u1', max_members: 10, member_count: 5, is_member: false, created_at: '2026-01-01T00:00:00Z' },
    ];
    mockGroupsService.getDiscoverableGroups.mockResolvedValue(mockGroups);

    await component.handleJoinGroup('g1');

    expect(mockGroupsService.joinGroup).toHaveBeenCalledWith('g1');
    expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalled();
  });

  it('notImplemented should show toast', () => {
    component.notImplemented();
    expect(toast.toastsSignal().length).toBeGreaterThan(0);
  });

  describe('toggleRoomLock', () => {
    it('locks an unlocked chat and adds it to lockedRoomIds', async () => {
      component.lockedRoomIds.set([]);
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(mockChatService.lockChat).toHaveBeenCalledWith('room-1');
      expect(component.lockedRoomIds()).toEqual(['room-1']);
      expect(component.isRoomLocked('room-1')).toBe(true);
    });

    it('unlocks a locked chat and removes it from lockedRoomIds', async () => {
      component.lockedRoomIds.set(['room-1']);
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(mockChatService.unlockChat).toHaveBeenCalledWith('room-1');
      expect(component.lockedRoomIds()).toEqual([]);
      expect(component.isRoomLocked('room-1')).toBe(false);
    });

    it('prevents navigation via the router link', async () => {
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('shows an error toast when the lock request fails', async () => {
      mockChatService.lockChat.mockRejectedValueOnce(new Error('network error'));
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as Event;

      await component.toggleRoomLock(event, 'room-1');

      expect(component.lockedRoomIds()).toEqual([]);
      expect(toast.toastsSignal().some((t) => t.type === 'error')).toBe(true);
    });
  });
});
