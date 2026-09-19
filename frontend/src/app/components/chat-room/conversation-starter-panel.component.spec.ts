import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { ConversationStarterPanelComponent } from './conversation-starter-panel.component';

describe('ConversationStarterPanelComponent', () => {
  let fixture: ComponentFixture<ConversationStarterPanelComponent>;
  let component: ConversationStarterPanelComponent;
  let chatService: {
    getRoomMembers: ReturnType<typeof vi.fn>;
    getConversationStarters: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    chatService = {
      getRoomMembers: vi.fn().mockResolvedValue([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ]),
      getConversationStarters: vi.fn().mockResolvedValue([
        'What are you learning this week?',
        'What food would you recommend?',
        'What place would you like to visit?',
      ]),
    };

    await TestBed.configureTestingModule({
      imports: [ConversationStarterPanelComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'user-1' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationStarterPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.detectChanges();
  });

  it('does not request suggestions until an empty chat has finished loading', async () => {
    await fixture.whenStable();
    expect(chatService.getRoomMembers).not.toHaveBeenCalled();

    fixture.componentRef.setInput('chatLoading', false);
    fixture.componentRef.setInput('messageCount', 1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(chatService.getRoomMembers).not.toHaveBeenCalled();
  });

  it('loads starters only for a two-person room containing the current user', async () => {
    fixture.componentRef.setInput('chatLoading', false);
    fixture.componentRef.setInput('messageCount', 0);
    fixture.componentRef.setInput('composerText', '');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(chatService.getRoomMembers).toHaveBeenCalledWith('room-1');
    expect(chatService.getConversationStarters).toHaveBeenCalledWith('user-2');
    expect(fixture.nativeElement.textContent).toContain('What are you learning this week?');
  });

  it('stays hidden for group chats', async () => {
    chatService.getRoomMembers.mockResolvedValue([
      { user_id: 'user-1' },
      { user_id: 'user-2' },
      { user_id: 'user-3' },
    ]);
    fixture.componentRef.setInput('chatLoading', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(chatService.getConversationStarters).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('hides as soon as the user starts composing', async () => {
    fixture.componentRef.setInput('chatLoading', false);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('composerText', 'My own opening message');
    fixture.detectChanges();

    expect(component.canShow()).toBe(false);
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('emits a selected starter without sending it', () => {
    const selected = vi.fn();
    component.suggestionSelected.subscribe(selected);
    fixture.componentRef.setInput('chatLoading', false);
    fixture.detectChanges();

    component.selectSuggestion('  Hello   there?  ');

    expect(selected).toHaveBeenCalledWith('Hello there?');
  });

  it('shows a retryable error when starter loading fails', async () => {
    chatService.getConversationStarters.mockRejectedValue(new Error('provider failed'));
    fixture.componentRef.setInput('chatLoading', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).not.toContain('provider failed');
  });
});
