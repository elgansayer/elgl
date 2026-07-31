import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatListComponent } from './chat-list.component';
import { ChatService } from '../../services/chat.service';
import * as toast from '../../services/toast.service';
import { provideRouter } from '@angular/router';

describe('ChatListComponent', () => {
  let component: ChatListComponent;
  let fixture: ComponentFixture<ChatListComponent>;
  let mockChatService: {
    getRooms: ReturnType<typeof vi.fn>;
    getRecentChats: ReturnType<typeof vi.fn>;
    getLockedRoomIds: ReturnType<typeof vi.fn>;
    lockChat: ReturnType<typeof vi.fn>;
    unlockChat: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockChatService = {
      getRooms: vi.fn().mockResolvedValue([]),
      getRecentChats: vi.fn().mockResolvedValue([]),
      getLockedRoomIds: vi.fn().mockResolvedValue([]),
      lockChat: vi.fn().mockResolvedValue(undefined),
      unlockChat: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ChatListComponent],
      providers: [{ provide: ChatService, useValue: mockChatService }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
