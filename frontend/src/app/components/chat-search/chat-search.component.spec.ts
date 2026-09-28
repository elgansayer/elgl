import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { ChatSearchComponent } from './chat-search.component';
import { ChatMessage, ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';

function message(id: string, roomId: string, type: ChatMessage['message_type'] = 'text'): ChatMessage {
  return {
    id,
    room_id: roomId,
    sender_id: 'sender-1',
    message_type: type,
    text_content: `${type} content`,
    is_read: true,
    created_at: '2026-08-24T00:00:00.000Z',
  };
}

describe('ChatSearchComponent', () => {
  let fixture: ComponentFixture<ChatSearchComponent>;
  let component: ChatSearchComponent;
  let searchMessages: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    searchMessages = vi.fn();
    navigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ChatSearchComponent],
      providers: [
        { provide: ChatService, useValue: { searchMessages } },
        { provide: Router, useValue: { navigate } },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatSearchComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-1');
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('debounces room-scoped search and filters message types locally', async () => {
    const text = message('m1', 'room-1', 'text');
    const voice = message('m2', 'room-1', 'voice');
    searchMessages.mockResolvedValue([text, voice]);

    component.query.set('hello');
    component.onSearch();
    expect(searchMessages).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(searchMessages).toHaveBeenCalledTimes(1);
    expect(searchMessages).toHaveBeenCalledWith('hello', 'room-1');
    expect(component.results()).toEqual([text, voice]);

    component.setSelectedType('voice');
    expect(component.results()).toEqual([voice]);
    expect(searchMessages).toHaveBeenCalledTimes(1);
  });

  it('re-runs an existing query when switching between room and global search', async () => {
    searchMessages.mockResolvedValue([]);
    component.query.set('bonjour');
    component.onSearch();
    await vi.advanceTimersByTimeAsync(300);

    component.setSearchMode('global');
    await vi.advanceTimersByTimeAsync(0);

    expect(searchMessages).toHaveBeenNthCalledWith(1, 'bonjour', 'room-1');
    expect(searchMessages).toHaveBeenNthCalledWith(2, 'bonjour', undefined);
  });

  it('keeps the newest result when an older request resolves late', async () => {
    let resolveOld: ((value: ChatMessage[]) => void) | undefined;
    const oldRequest = new Promise<ChatMessage[]>((resolve) => {
      resolveOld = resolve;
    });
    const newest = [message('new', 'room-1')];

    searchMessages.mockReturnValueOnce(oldRequest).mockResolvedValueOnce(newest);

    component.query.set('older');
    component.onSearch();
    await vi.advanceTimersByTimeAsync(300);

    component.query.set('newer');
    component.onSearch();
    await vi.advanceTimersByTimeAsync(300);

    expect(component.results()).toEqual(newest);
    resolveOld?.([message('old', 'room-1')]);
    await Promise.resolve();

    expect(component.results()).toEqual(newest);
  });

  it('distinguishes provider failure from a genuine empty result and retries', async () => {
    searchMessages.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce([]);

    component.query.set('error');
    component.onSearch();
    await vi.advanceTimersByTimeAsync(300);

    expect(component.searchError()).toBe(true);
    expect(component.results()).toEqual([]);

    component.retrySearch();
    await vi.advanceTimersByTimeAsync(0);

    expect(searchMessages).toHaveBeenCalledTimes(2);
    expect(component.searchError()).toBe(false);
    expect(component.results()).toEqual([]);
  });

  it('does not search or show stale state for queries shorter than two characters', async () => {
    searchMessages.mockResolvedValue([message('m1', 'room-1')]);
    component.query.set('hello');
    component.onSearch();
    await vi.advanceTimersByTimeAsync(300);
    expect(component.results()).toHaveLength(1);

    component.query.set('x');
    component.onSearch();

    expect(component.results()).toEqual([]);
    expect(component.searchError()).toBe(false);
    expect(component.isSearching()).toBe(false);
    expect(searchMessages).toHaveBeenCalledTimes(1);
  });

  it('emits selected messages and navigates only for global results', () => {
    const selected = message('m1', 'room-2');
    const emitted: ChatMessage[] = [];
    component.messageSelect.subscribe((value) => emitted.push(value));

    component.selectMessage(selected);
    expect(emitted).toEqual([selected]);
    expect(navigate).not.toHaveBeenCalled();

    component.searchMode.set('global');
    component.selectMessage(selected);
    expect(navigate).toHaveBeenCalledWith(['/chat', 'room-2']);
  });
});
