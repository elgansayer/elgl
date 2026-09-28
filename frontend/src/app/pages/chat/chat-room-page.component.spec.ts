import { describe, expect, it, vi } from 'vitest';
import { applyConversationStarterToComposer } from './chat-room-page.component';

describe('applyConversationStarterToComposer', () => {
  it('places a selected starter in an empty composer and persists the draft', () => {
    const saveChatDrafts = vi.fn();
    const target = {
      messages: () => [],
      textInput: '',
      saveChatDrafts,
    };

    const applied = applyConversationStarterToComposer(
      target,
      '  What   are you learning today?  ',
    );

    expect(applied).toBe(true);
    expect(target.textInput).toBe('What are you learning today?');
    expect(saveChatDrafts).toHaveBeenCalledTimes(1);
  });

  it('never auto-replaces a message the user has started typing', () => {
    const saveChatDrafts = vi.fn();
    const target = {
      messages: () => [],
      textInput: 'My own message',
      saveChatDrafts,
    };

    expect(applyConversationStarterToComposer(target, 'Suggested question?')).toBe(false);
    expect(target.textInput).toBe('My own message');
    expect(saveChatDrafts).not.toHaveBeenCalled();
  });

  it('does not apply starters once the conversation has messages', () => {
    const saveChatDrafts = vi.fn();
    const target = {
      messages: () => [{ id: 'message-1' }],
      textInput: '',
      saveChatDrafts,
    };

    expect(applyConversationStarterToComposer(target, 'Suggested question?')).toBe(false);
    expect(target.textInput).toBe('');
    expect(saveChatDrafts).not.toHaveBeenCalled();
  });
});
