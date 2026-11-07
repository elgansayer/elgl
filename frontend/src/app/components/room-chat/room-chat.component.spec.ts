import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { RoomChatComponent } from './room-chat.component';

describe('RoomChatComponent', () => {
  let component: RoomChatComponent;
  let fixture: ComponentFixture<RoomChatComponent>;

  const store = {
    currentRoom: signal(null),
    roomMessages: signal<{ id: string }[]>([]),
    captions: signal<{ id: string }[]>([]),
    isSpeaker: signal(true),
    sendRoomChatMessage: vi.fn().mockResolvedValue(undefined),
    sendCaption: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomChatComponent],
      providers: [{ provide: AudioRoomsStore, useValue: store }],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('names the chat composer through an accessible name instead of hint text', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe('Send a chat message to the room...');
    expect(input.hasAttribute('placeholder')).toBe(false);
  });

  it('names the speaker caption composer through an accessible name instead of hint text', () => {
    component.activeTab.set('subtitles');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBe(
      'Simulate speech-to-text live subtitle broadcast...',
    );
    expect(input.hasAttribute('placeholder')).toBe(false);
  });
});
