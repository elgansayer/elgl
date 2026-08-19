import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { signal } from '@angular/core';
import { vi } from 'vitest';

import { ChatPageComponent } from './chat-page.component';
import { ChatService, ChatMessage, ChatRoom } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { AiConversationService, Scenario } from './ai-conversation.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

describe('ChatPageComponent', () => {
  let component: ChatPageComponent;
  let fixture: ComponentFixture<ChatPageComponent>;

  const chatServiceMock = {
    getRooms: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    downloadChatHistory: vi.fn(),
    fixMessage: vi.fn(),
    replyToStatusUpdate: vi.fn(),
    markMessageStatus: vi.fn().mockResolvedValue(undefined),
  };

  const authServiceMock = {
    currentUser: signal({ id: 'test-user' }),
  };

  const centrifugoServiceMock = {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
  };

  const aiConversationServiceMock = {
    getScenarios: vi.fn(),
    sendMessage: vi.fn(),
  };

  const i18nServiceMock = {
    translate: (key: string) => key,
  };

  const room = {
    id: 'room-1',
    title: 'Test Room',
    subtitle: 'Subtitle',
    avatar: '',
    is_online: true,
  } as ChatRoom;

  const message: ChatMessage = {
    id: 'msg-1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Hello',
    created_at: new Date().toISOString(),
    is_read: false,
  };

  const scenarios: Scenario[] = [
    { id: 'ordering-coffee', name: 'Ordering Coffee', icon: '\u2615' },
    { id: 'job-interview', name: 'Job Interview', icon: '\u{1F4BC}' },
  ];

  beforeEach(async () => {
    chatServiceMock.getRooms.mockReset();
    chatServiceMock.getMessages.mockReset();
    chatServiceMock.sendMessage.mockReset();
    chatServiceMock.downloadChatHistory.mockReset();
    chatServiceMock.fixMessage.mockReset();
    chatServiceMock.replyToStatusUpdate.mockReset();
    chatServiceMock.markMessageStatus.mockReset();
    chatServiceMock.markMessageStatus.mockResolvedValue(undefined);
    centrifugoServiceMock.subscribe.mockReset();
    centrifugoServiceMock.unsubscribe.mockReset();
    aiConversationServiceMock.getScenarios.mockReset();
    aiConversationServiceMock.sendMessage.mockReset();

    await TestBed.configureTestingModule({
      imports: [FormsModule, DatePipe, TranslatePipe, ChatPageComponent],
      providers: [
        { provide: ChatService, useValue: chatServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: CentrifugoService, useValue: centrifugoServiceMock },
        { provide: AiConversationService, useValue: aiConversationServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('room and message loading', () => {
    it('should load rooms on init', async () => {
      const rooms = [room];
      chatServiceMock.getRooms.mockReset();
      chatServiceMock.getRooms.mockResolvedValue(rooms);

      await component.ngOnInit();

      expect(chatServiceMock.getRooms).toHaveBeenCalledTimes(1);
      expect(component.rooms()).toEqual(rooms);
    });

    it('should select a room and load its messages', async () => {
      const messages = [message];
      chatServiceMock.getMessages.mockResolvedValue(messages);

      await component.selectRoom(room);

      expect(chatServiceMock.getMessages).toHaveBeenCalledWith('room-1');
      expect(component.selectedRoom()).toEqual(room);
      expect(component.messages()).toEqual(messages);
    });

    it('should select a room from the keyboard with Space', () => {
      component.rooms.set([room]);
      fixture.detectChanges();
      const selectRoom = vi.spyOn(component, 'selectRoom').mockResolvedValue();
      const roomAction = fixture.nativeElement.querySelector('div[role="button"]');
      const event = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });

      roomAction.dispatchEvent(event);

      expect(selectRoom).toHaveBeenCalledWith(room);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('sending a message', () => {
    it('should call sendMessage and add the result', async () => {
      component.selectedRoom.set(room);
      component.newMessageText.set('Hello');

      const sentMessage = { ...message, id: 'msg-2', sender_id: 'test-user' } as ChatMessage;
      chatServiceMock.sendMessage.mockResolvedValue(sentMessage);

      await component.sendMessage();

      expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
        room_id: 'room-1',
        message_type: 'text',
        text_content: 'Hello',
      });
      expect(component.messages()).toContain(sentMessage);
      expect(component.newMessageText()).toBe('');
    });

    it('should ignore empty messages', async () => {
      component.selectedRoom.set(room);
      component.newMessageText.set('   ');

      await component.sendMessage();

      expect(chatServiceMock.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('export chat history', () => {
    it('should call downloadChatHistory with the selected room id', async () => {
      component.selectedRoom.set(room);
      chatServiceMock.downloadChatHistory.mockResolvedValue(undefined);

      await component.exportChat();

      expect(chatServiceMock.downloadChatHistory).toHaveBeenCalledWith('room-1');
    });

    it('should not call downloadChatHistory when no room is selected', async () => {
      component.selectedRoom.set(null);

      await component.exportChat();

      expect(chatServiceMock.downloadChatHistory).not.toHaveBeenCalled();
    });
  });

  describe('AI conversation partner', () => {
    it('should enable AI mode and load scenarios on first start', () => {
      component.aiMessages.set([]);
      aiConversationServiceMock.getScenarios.mockResolvedValue(scenarios);

      component.startAiPartner();

      expect(component.aiMode()).toBe(true);
      expect(component.selectedRoom()).toBeNull();
      expect(component.aiSelectedScenario()).toBeNull();
      expect(aiConversationServiceMock.getScenarios).toHaveBeenCalledTimes(1);
    });

    it('should not re-load scenarios if already loaded', () => {
      component.aiScenarios.set(scenarios);
      aiConversationServiceMock.getScenarios.mockReset();

      component.startAiPartner();

      expect(aiConversationServiceMock.getScenarios).not.toHaveBeenCalled();
    });

    it('should select a scenario and clear messages', () => {
      component.aiMessages.set([
        { id: 'old-1', role: 'user', text: 'old', created_at: new Date() },
      ]);

      component.selectAiScenario(scenarios[0]);

      expect(component.aiSelectedScenario()!.id).toBe('ordering-coffee');
      expect(component.aiMessages().length).toBe(0);
      expect(component.aiError()).toBe('');
    });

    it('should select free conversation (null scenario)', () => {
      component.selectAiScenario(null);

      expect(component.aiSelectedScenario()).toBeNull();
    });

    it('should close AI partner and reset state', () => {
      component.aiMode.set(true);
      component.aiSelectedScenario.set(scenarios[0]);
      component.aiMessages.set([{ id: 'm1', role: 'user', text: 'hi', created_at: new Date() }]);

      component.closeAiPartner();

      expect(component.aiMode()).toBe(false);
      expect(component.aiSelectedScenario()).toBeNull();
      expect(component.aiMessages().length).toBe(0);
    });

    it('should send a user message and append the AI reply', async () => {
      component.aiMode.set(true);
      component.aiMessages.set([]);
      component.aiInput.set('Hello AI');
      component.aiSelectedScenario.set(scenarios[0]);

      aiConversationServiceMock.sendMessage.mockResolvedValue('Hello back');

      await component.sendAiMessage();

      expect(component.aiInput()).toBe('');
      expect(component.aiLoading()).toBe(false);
      expect(component.aiMessages().length).toBe(2);

      const [userMsg, aiMsg] = component.aiMessages();
      expect(userMsg.role).toBe('user');
      expect(userMsg.text).toBe('Hello AI');
      expect(aiMsg.role).toBe('ai');
      expect(aiMsg.text).toBe('Hello back');

      expect(aiConversationServiceMock.sendMessage).toHaveBeenCalledWith(
        'Hello AI',
        'ordering-coffee',
        [],
      );
    });

    it('should set an error when the AI request fails', async () => {
      component.aiMode.set(true);
      component.aiMessages.set([]);
      component.aiInput.set('Anything');
      component.aiSelectedScenario.set(null);

      aiConversationServiceMock.sendMessage.mockRejectedValue(new Error('network'));

      await component.sendAiMessage();

      expect(component.aiError()).toBe('aiPartner.error');
      expect(component.aiLoading()).toBe(false);
    });
  });

  describe('read receipts', () => {
    it('should mark messages from others as delivered and read when selecting a room', async () => {
      const otherMessage: ChatMessage = {
        id: 'msg-other',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'text',
        text_content: 'Hello',
        created_at: new Date().toISOString(),
        is_read: false,
        delivery_status: 'sent',
      };
      const ownMessage: ChatMessage = {
        id: 'msg-own',
        room_id: 'room-1',
        sender_id: 'test-user',
        message_type: 'text',
        text_content: 'Hi',
        created_at: new Date().toISOString(),
        is_read: false,
        delivery_status: 'sent',
      };
      chatServiceMock.getMessages.mockResolvedValue([otherMessage, ownMessage]);

      await component.selectRoom(room);

      expect(chatServiceMock.markMessageStatus).toHaveBeenCalledWith('msg-other', 'delivered');
      expect(chatServiceMock.markMessageStatus).toHaveBeenCalledWith('msg-other', 'read');
      // Own messages should not be marked
      expect(chatServiceMock.markMessageStatus).not.toHaveBeenCalledWith(
        'msg-own',
        expect.any(String),
      );
    });

    it('should not re-mark messages already delivered or read', async () => {
      const alreadyReadMessage: ChatMessage = {
        id: 'msg-read',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'text',
        text_content: 'Already read',
        created_at: new Date().toISOString(),
        is_read: true,
        delivery_status: 'read',
      };
      const alreadyDeliveredMessage: ChatMessage = {
        id: 'msg-delivered',
        room_id: 'room-1',
        sender_id: 'user-3',
        message_type: 'text',
        text_content: 'Already delivered',
        created_at: new Date().toISOString(),
        is_read: false,
        delivery_status: 'delivered',
      };
      chatServiceMock.getMessages.mockResolvedValue([alreadyReadMessage, alreadyDeliveredMessage]);

      await component.selectRoom(room);

      expect(chatServiceMock.markMessageStatus).not.toHaveBeenCalledWith(
        'msg-read',
        expect.any(String),
      );
      expect(chatServiceMock.markMessageStatus).not.toHaveBeenCalledWith(
        'msg-delivered',
        expect.any(String),
      );
    });

    it('should render double blue checkmarks for messages with delivery_status read', async () => {
      const readMessage: ChatMessage = {
        id: 'msg-read-display',
        room_id: 'room-1',
        sender_id: 'test-user',
        message_type: 'text',
        text_content: 'My message read by others',
        created_at: new Date().toISOString(),
        is_read: false,
        delivery_status: 'read',
      };
      chatServiceMock.getMessages.mockResolvedValue([readMessage]);

      await component.selectRoom(room);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      // Check for the read-state checkmark (text-primary)
      const readChecks = compiled.querySelectorAll('.text-primary');
      expect(readChecks.length).toBeGreaterThan(0);
    });
  });

  describe('correction and fix flows', () => {
    it('should open the correction panel for a message', () => {
      component.openCorrection(message);

      expect(component.correctionTargetMessage()).toEqual(message);
      expect(component.correctionText()).toBe('Hello');
    });

    it('should cancel the correction panel', () => {
      component.openCorrection(message);
      component.cancelCorrection();

      expect(component.correctionTargetMessage()).toBeNull();
      expect(component.correctionText()).toBe('');
    });

    it('should submit a correction message', async () => {
      component.openCorrection(message);
      component.correctionText.set('Hola');
      component.correctionExplanation.set('Spanish');

      const correctionMessage = {
        id: 'corr-1',
        room_id: 'room-1',
        sender_id: 'test-user',
        message_type: 'correction',
        text_content: '',
      } as ChatMessage;

      chatServiceMock.sendMessage.mockResolvedValue(correctionMessage);

      await component.submitCorrection();

      expect(chatServiceMock.sendMessage).toHaveBeenCalledWith({
        room_id: 'room-1',
        message_type: 'correction',
        correction_payload: {
          original: 'Hello',
          corrected: 'Hola',
          explanation: 'Spanish',
        },
        reply_to_id: 'msg-1',
      });
      expect(component.messages()).toContain(correctionMessage);
      expect(component.correctionTargetMessage()).toBeNull();
    });
  });
});
