import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveChatOverlayComponent } from './live-chat-overlay.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';

describe('LiveChatOverlayComponent', () => {
  let component: LiveChatOverlayComponent;
  let fixture: ComponentFixture<LiveChatOverlayComponent>;
  let mockCentrifugo: { subscribe: ReturnType<typeof vi.fn>; unsubscribe: ReturnType<typeof vi.fn> };
  let mockI18n: { translate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
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

    fixture = TestBed.createComponent(LiveChatOverlayComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'test-room');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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

  it('should cap messages at 50', () => {
    for (let i = 0; i < 60; i++) {
      component.messages.update((msgs) => [
        ...msgs,
        { id: `msg-${i}`, senderName: 'Test', text: `Text ${i}`, timestamp: Date.now() },
      ]);
    }

    expect(component.messages().length).toBeLessThanOrEqual(50);
  });

  it('should render overlay container with gradient', () => {
    const el: HTMLElement = fixture.nativeElement;
    const overlay = el.querySelector('.bg-gradient-to-t');
    expect(overlay).toBeTruthy();
  });

  it('should display messages with sender name and text', () => {
    component.messages.set([
      { id: '1', senderName: 'Alice', text: 'Hello world', timestamp: 1 },
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Hello world');
  });

  it('should apply fade-in animation class to messages', () => {
    component.messages.set([
      { id: '1', senderName: 'Bob', text: 'Hi', timestamp: 1 },
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.animate-fade-in')).toBeTruthy();
  });
});