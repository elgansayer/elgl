import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoomChatComponent } from './room-chat.component';
import { CentrifugoService } from '../../services/centrifugo.service';
import { I18nService } from '../../services/i18n.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('RoomChatComponent', () => {
  let component: RoomChatComponent;
  let fixture: ComponentFixture<RoomChatComponent>;
  let centrifugoMock: {
    subscribeLiveRoom: ReturnType<typeof vi.fn>;
    unsubscribeLiveRoom: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    centrifugoMock = {
      subscribeLiveRoom: vi.fn(),
      unsubscribeLiveRoom: vi.fn(),
      publish: vi.fn(),
    };

    const i18nMock = {
      translate: (key: string) => key,
    };

    await TestBed.configureTestingModule({
      imports: [RoomChatComponent],
      providers: [
        { provide: CentrifugoService, useValue: centrifugoMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoomChatComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should subscribe to the correct room channel', () => {
    expect(centrifugoMock.subscribeLiveRoom).toHaveBeenCalledWith(
      'room-123',
      expect.any(Function),
    );
  });

  it('should send a text message when sendMessage is called', () => {
    component.inputText.set('Hello');
    component.sendMessage();
    expect(centrifugoMock.publish).toHaveBeenCalledWith('room_room-123', {
      type: 'text',
      content: 'Hello',
    });
    expect(component.inputText()).toBe('');
  });
});
