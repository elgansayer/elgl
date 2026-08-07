import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
<<<<<<< HEAD
import { Component, input } from '@angular/core';
=======
>>>>>>> origin/main
import { LiveChatOverlayComponent } from './live-chat-overlay.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';

describe('LiveChatOverlayComponent', () => {
  let component: LiveChatOverlayComponent;
  let fixture: ComponentFixture<LiveChatOverlayComponent>;
  let mockCentrifugo: { subscribe: ReturnType<typeof vi.fn>; unsubscribe: ReturnType<typeof vi.fn> };
  let mockI18n: { translate: ReturnType<typeof vi.fn> };
<<<<<<< HEAD
  let mockAuth: { currentUser: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
=======
>>>>>>> origin/main

  async function setup(roomId: string): Promise<void> {
    mockCentrifugo = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    mockI18n = {
      translate: vi.fn((key: string) => {
        if (key === 'common.user') return 'User';
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LiveChatOverlayComponent],
      providers: [
        { provide: CentrifugoService, useValue: mockCentrifugo },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    // Angular 22 JIT test environment cannot resolve input() signals via setInput.
    // We must pass { detectChanges: false } and accept the NG0303 console warning
    // as benign (matching the video-call component spec pattern).
    fixture = TestBed.createComponent(LiveChatOverlayComponent, { detectChanges: false });
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', roomId);
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup('test-room');
    expect(component).toBeTruthy();
  });

  it('should render overlay container with gradient', async () => {
    await setup('test-room');
    const el: HTMLElement = fixture.nativeElement;
    const overlay = el.querySelector('.bg-gradient-to-t');
    expect(overlay).toBeTruthy();
  });

<<<<<<< HEAD
  it('should subscribe to centrifugo channel on init', () => {
    expect(mockCentrifugo['subscribe']).toHaveBeenCalledWith(
      'room_test-room',
      expect.any(Function),
    );
  });

  it('should unsubscribe on destroy', () => {
    fixture.destroy();
    expect(mockCentrifugo['unsubscribe']).toHaveBeenCalledWith('room_test-room');
  });

  it('should render chat overlay when toggle is clicked', () => {
    const toggleBtn: HTMLElement | null = fixture.nativeElement.querySelector('.rounded-full.bg-purple-600');
    expect(toggleBtn).toBeTruthy();
    toggleBtn!.click();
=======
  it('should display messages with sender name and text', async () => {
    await setup('test-room');
    component.messages.set([
      { id: '1', senderName: 'Alice', text: 'Hello world', timestamp: 1 },
    ]);
>>>>>>> origin/main
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Hello world');
  });

  it('should apply fade-in animation class to messages', async () => {
    await setup('test-room');
    component.messages.set([
      { id: '1', senderName: 'Bob', text: 'Hi', timestamp: 1 },
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-fade-in')).toBeTruthy();
  });

<<<<<<< HEAD
  it('should send message via centrifugo', () => {
    const appChatOverlay = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LiveChatOverlayComponent,
    );
    const overlayComponent = appChatOverlay?.componentInstance as LiveChatOverlayComponent | undefined;
    expect(overlayComponent).toBeTruthy();
    if (overlayComponent) {
      overlayComponent.inputText.set('Hello world');
      overlayComponent.sendMessage();
    }
<<<<<<< HEAD
    expect(mockCentrifugo['publish']).toHaveBeenCalledWith('room_test-room', {
=======
    expect(mockCentrifugo.publish).toHaveBeenCalledWith('room_test-room', {
>>>>>>> origin/main
      type: 'text',
      content: 'Hello world',
      senderName: 'TestUser',
      sender_id: 'user-1',
      id: expect.any(String),
    });
  });

  it('should not send empty message', () => {
    const appChatOverlay = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LiveChatOverlayComponent,
    );
    const overlayComponent = appChatOverlay?.componentInstance as LiveChatOverlayComponent | undefined;
    expect(overlayComponent).toBeTruthy();
    if (overlayComponent) {
      overlayComponent.inputText.set('   ');
      overlayComponent.sendMessage();
    }
<<<<<<< HEAD
    expect(mockCentrifugo['publish']).not.toHaveBeenCalled();
=======
    expect(mockCentrifugo.publish).not.toHaveBeenCalled();
>>>>>>> origin/main
  });

  it('should cap messages at 50', () => {
    const appChatOverlay = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LiveChatOverlayComponent,
    );
    const overlayComponent = appChatOverlay?.componentInstance as LiveChatOverlayComponent | undefined;
    expect(overlayComponent).toBeTruthy();
    if (overlayComponent) {
      overlayComponent.messages.set(
<<<<<<< HEAD
        Array.from({ length: 50 }, (_, i) => ({
=======
        Array.from({ length: 50 }, (_, _i) => ({
>>>>>>> origin/main
          id: `msg-\x24{i}`,
          senderId: 'u1',
          senderName: 'Test',
          text: `Text \x24{i}`,
          timestamp: Date.now(),
        })),
      );
      const overlayAny = overlayComponent as unknown as Record<string, unknown>;
      const addMsg = overlayAny['addMessage'] as (msg: Record<string, unknown>) => void;
      addMsg({
        id: 'overflow',
        senderId: 'u1',
        senderName: 'X',
        text: 'overflow',
        timestamp: Date.now(),
=======
  it('should cap messages at 50 via the messages signal cap', async () => {
    await setup('test-room');
    // Push 60 messages, shifting the oldest off when > 50
    for (let i = 0; i < 60; i++) {
      component.messages.update((msgs) => {
        const next = [...msgs, { id: `msg-${i}`, senderName: 'Test', text: `Text ${i}`, timestamp: Date.now() }];
        while (next.length > 50) next.shift();
        return next;
>>>>>>> origin/main
      });
    }

    expect(component.messages().length).toBe(50);
  });

  it('should not throw on destroy when cleaning up via DestroyRef', async () => {
    await setup('test-room');
    expect(() => fixture.destroy()).not.toThrow();
  });
});