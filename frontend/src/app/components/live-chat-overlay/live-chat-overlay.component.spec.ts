import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { resolveComponentResources } from '@angular/core';
import { Component, input } from '@angular/core';
import { LiveChatOverlayComponent } from './live-chat-overlay.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  template: `<div style="position: relative; height: 600px;">
    <app-live-chat-overlay [roomId]="roomId()"></app-live-chat-overlay>
  </div>`,
  imports: [LiveChatOverlayComponent],
})
class TestHostComponent {
  readonly roomId = input.required<string>();
}

describe('LiveChatOverlayComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let mockCentrifugo: Record<string, ReturnType<typeof vi.fn>>;
  let mockI18n: { translate: ReturnType<typeof vi.fn> };
  let mockAuth: { currentUser: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveComponentResources(LiveChatOverlayComponent);
  });

  beforeEach(async () => {
    try {
      TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    } catch {
      // Ignore if already initialized
    }

    mockCentrifugo = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    };

    mockI18n = {
      translate: vi.fn((key: string) => {
        if (key === 'common.user') return 'User';
        return key;
      }),
    };

    mockAuth = {
      currentUser: vi.fn(() => ({ id: 'user-1', display_name: 'TestUser' })),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LiveChatOverlayComponent],
      providers: [
        { provide: CentrifugoService, useValue: mockCentrifugo },
        { provide: I18nService, useValue: mockI18n },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentRef.setInput('roomId', 'test-room');
    fixture.detectChanges();
  });

  it('should create and render collapsed chat button', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-live-chat-overlay')).toBeTruthy();
    expect(el.querySelector('.rounded-full.bg-purple-600')).toBeTruthy();
  });

  it('should subscribe to centrifugo channel on init', () => {
    expect(mockCentrifugo.subscribe).toHaveBeenCalledWith(
      'room_test-room',
      expect.any(Function),
    );
  });

  it('should unsubscribe on destroy', () => {
    fixture.destroy();
    expect(mockCentrifugo.unsubscribe).toHaveBeenCalledWith('room_test-room');
  });

  it('should render chat overlay when toggle is clicked', () => {
    const toggleBtn: HTMLElement | null = fixture.nativeElement.querySelector('.rounded-full.bg-purple-600');
    expect(toggleBtn).toBeTruthy();
    toggleBtn!.click();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('roomChat.overlayTitle');
  });

  it('should show message count badge when messages exist', () => {
    const appChatOverlay = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LiveChatOverlayComponent,
    );
    const overlayComponent = appChatOverlay?.componentInstance as LiveChatOverlayComponent | undefined;
    expect(overlayComponent).toBeTruthy();
    if (overlayComponent) {
      overlayComponent.messages.set([
        { id: '1', senderId: 'u1', senderName: 'Alice', text: 'Hi', timestamp: 1 },
      ]);
      fixture.detectChanges();
    }
    const el: HTMLElement = fixture.nativeElement;
    const badge = el.querySelector('.bg-red-500');
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.trim()).toBe('1');
  });

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
    expect(mockCentrifugo.publish).toHaveBeenCalledWith('room_test-room', {
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
    expect(mockCentrifugo.publish).not.toHaveBeenCalled();
  });

  it('should cap messages at 50', () => {
    const appChatOverlay = fixture.debugElement.query(
      (d) => d.componentInstance instanceof LiveChatOverlayComponent,
    );
    const overlayComponent = appChatOverlay?.componentInstance as LiveChatOverlayComponent | undefined;
    expect(overlayComponent).toBeTruthy();
    if (overlayComponent) {
      overlayComponent.messages.set(
        Array.from({ length: 50 }, (_, i) => ({
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
      });
      expect(overlayComponent.messages().length).toBe(50);
    }
  });
});
