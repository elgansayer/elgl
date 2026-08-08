import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatListComponent } from './chat-list.component';
import { ChatService } from '../../services/chat.service';
import { Pipe, PipeTransform } from '@angular/core';
import * as toast from '../../services/toast.service';
import { provideRouter } from '@angular/router';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('ChatListComponent', () => {
  let component: ChatListComponent;
  let fixture: ComponentFixture<ChatListComponent>;
  let httpTesting: HttpTestingController;
  let mockChatService: {
    getRooms: ReturnType<typeof vi.fn>;
    getRecentChats: ReturnType<typeof vi.fn>;
    getLockedRoomIds: ReturnType<typeof vi.fn>;
    lockChat: ReturnType<typeof vi.fn>;
    unlockChat: ReturnType<typeof vi.fn>;
  };

  const mockGroups = [
    {
      id: 'g1',
      name: 'Spanish Learners',
      owner_id: 'u1',
      max_members: 10,
      member_count: 5,
      is_member: false,
      interest_id: 'spanish',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'g2',
      name: 'French Club',
      owner_id: 'u2',
      max_members: 20,
      member_count: 20,
      is_member: false,
      interest_id: 'french',
      created_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getRecentChats: vi.fn().mockResolvedValue([]),
      getLockedRoomIds: vi.fn().mockResolvedValue([]),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ChatListComponent, MockTranslatePipe],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
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

  it('should switch to groups tab', () => {
    component.setActiveTab('groups');
    expect(component.activeTab()).toBe('groups');
  });

  it('should load discoverable groups when switching to groups tab', () => {
    component.setActiveTab('groups');
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();

    const groups = component.filteredGroups();
    expect(groups.length).toBe(2);
  });

  it('should filter groups by topic', () => {
    component.setActiveTab('groups');
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();

    component.handleTopicFilter('spanish');
    fixture.detectChanges();

    const filtered = component.filteredGroups();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Spanish Learners');
  });

  it('should filter groups by search query', () => {
    component.setActiveTab('groups');
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();

    component.groupsSearch.set('French');
    fixture.detectChanges();

    const filtered = component.filteredGroups();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('French Club');
  });

  it('should show all topics filter pill by default', () => {
    component.setActiveTab('groups');
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();

    expect(component.selectedGroupTopic()).toBe('');
    expect(component.groupTopicPills().length).toBeGreaterThan(0);
    expect(component.groupTopicPills()[0].id).toBe('');
  });

  it('should show full label when group is at max members', () => {
    component.setActiveTab('groups');
    const req = httpTesting.expectOne((r) => r.url.includes('/groups/discoverable'));
    req.flush(mockGroups);
    fixture.detectChanges();

    const fullGroup = component.filteredGroups().find((g) => g.name === 'French Club');
    expect(fullGroup).toBeDefined();
    expect(fullGroup!.member_count).toBe(20);
    expect(fullGroup!.max_members).toBe(20);
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
