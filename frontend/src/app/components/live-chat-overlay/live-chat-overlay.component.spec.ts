import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioRoomsStore, RoomChatMessage } from '../../services/audio-rooms.store';
import { I18nService } from '../../services/i18n.service';
import {
  buildLiveOverlayMessages,
  LiveChatOverlayComponent,
} from './live-chat-overlay.component';

describe('buildLiveOverlayMessages', () => {
  it('keeps only the newest 30 unique valid messages in chronological order', () => {
    const messages = Array.from({ length: 35 }, (_, index) => ({
      id: `message-${index}`,
      sender_name: 'Alice',
      text_content: `Message ${index}`,
    }));
    messages.push({ id: 'message-34', sender_name: 'Alice', text_content: 'Latest replay' });

    const result = buildLiveOverlayMessages(messages, 'User');

    expect(result).toHaveLength(30);
    expect(result[0]?.id).toBe('message-6');
    expect(result.at(-1)).toEqual({
      id: 'message-34',
      senderName: 'Alice',
      text: 'Latest replay',
    });
  });

  it('rejects malformed records and falls back when the sender name is unusable', () => {
    const result = buildLiveOverlayMessages(
      [
        null,
        [],
        { id: '', sender_name: 'Bad', text_content: 'Missing id' },
        { id: 'blank', sender_name: 'Bad', text_content: '   ' },
        { id: 'valid', sender_name: 42, text_content: ' Hello ' },
      ],
      'Learner',
    );

    expect(result).toEqual([{ id: 'valid', senderName: 'Learner', text: 'Hello' }]);
  });

  it('bounds sender names and visible comment text without corrupting Unicode code points', () => {
    const result = buildLiveOverlayMessages(
      [
        {
          id: 'unicode',
          sender_name: '名'.repeat(100),
          text_content: '😀'.repeat(600),
        },
      ],
      'User',
    );

    expect(Array.from(result[0]?.senderName ?? '')).toHaveLength(80);
    expect(Array.from(result[0]?.text ?? '')).toHaveLength(500);
    expect(result[0]?.text.endsWith('😀')).toBe(true);
  });

  it('rejects overlong IDs rather than truncating them into ambiguous tracking keys', () => {
    expect(
      buildLiveOverlayMessages(
        [{ id: 'x'.repeat(129), sender_name: 'Alice', text_content: 'Hello' }],
        'User',
      ),
    ).toEqual([]);
  });
});

describe('LiveChatOverlayComponent', () => {
  let component: LiveChatOverlayComponent;
  let fixture: ComponentFixture<LiveChatOverlayComponent>;
  let mockStore: {
    currentRoom: ReturnType<typeof signal<{ id: string } | null>>;
    roomMessages: ReturnType<typeof signal<RoomChatMessage[]>>;
  };

  beforeEach(async () => {
    mockStore = {
      currentRoom: signal<{ id: string } | null>({ id: 'test-room' }),
      roomMessages: signal<RoomChatMessage[]>([]),
    };

    await TestBed.configureTestingModule({
      imports: [LiveChatOverlayComponent],
      providers: [
        { provide: AudioRoomsStore, useValue: mockStore },
        {
          provide: I18nService,
          useValue: { translate: vi.fn((key: string) => (key === 'common.user' ? 'User' : key)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LiveChatOverlayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'test-room');
    fixture.detectChanges();
  });

  it('renders canonical room-chat state over the active room', () => {
    mockStore.roomMessages.set([
      {
        id: 'message-1',
        sender_id: 'user-1',
        sender_name: 'Alice',
        text_content: 'Hello from the room',
        created_at: '2026-08-27T09:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Alice');
    expect(element.textContent).toContain('Hello from the room');
  });

  it('does not render stale messages after the active room changes', () => {
    mockStore.roomMessages.set([
      {
        id: 'message-1',
        sender_id: 'user-1',
        sender_name: 'Alice',
        text_content: 'Private old-room comment',
        created_at: '2026-08-27T09:00:00.000Z',
      },
    ]);
    mockStore.currentRoom.set({ id: 'different-room' });
    fixture.detectChanges();

    expect(component.messages()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Private old-room comment');
  });

  it('keeps the visual overlay non-interactive and hidden from assistive technology', () => {
    mockStore.roomMessages.set([
      {
        id: 'message-1',
        sender_id: 'user-1',
        sender_name: 'Alice',
        text_content: 'Visual duplicate',
        created_at: '2026-08-27T09:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const overlay: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="live-chat-overlay"]',
    );
    expect(overlay?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay?.classList.contains('pointer-events-none')).toBe(true);
    expect(overlay?.querySelectorAll('button, input, a, [tabindex]').length).toBe(0);
  });

  it('renders untrusted comment markup as text and preserves mixed-direction content', () => {
    mockStore.roomMessages.set([
      {
        id: 'message-1',
        sender_id: 'user-1',
        sender_name: '<img src=x onerror=alert(1)>',
        text_content: '<script>alert(1)</script> مرحبا hello',
        created_at: '2026-08-27T09:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const overlay: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="live-chat-overlay"]',
    );
    expect(overlay?.querySelector('script, img')).toBeNull();
    expect(overlay?.textContent).toContain('<script>alert(1)</script> مرحبا hello');
    expect(overlay?.querySelector('.live-comment')?.getAttribute('dir')).toBe('auto');
  });
});
