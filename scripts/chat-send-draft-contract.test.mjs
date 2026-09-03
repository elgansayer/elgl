import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentSource = readFileSync(
  new URL(
    '../frontend/src/app/components/chat-room/chat-room.component.ts',
    import.meta.url,
  ),
  'utf8',
);

function sendTextMessageSource() {
  const startMarker = '  async sendTextMessage(): Promise<void> {';
  const endMarker = '\n  async sendCorrection(): Promise<void> {';
  const start = componentSource.indexOf(startMarker);
  const end = componentSource.indexOf(endMarker, start);

  assert.notEqual(start, -1, 'ChatRoomComponent.sendTextMessage() must exist');
  assert.notEqual(end, -1, 'sendTextMessage() must remain independently inspectable');

  return componentSource.slice(start, end);
}

test('clears the composer and persisted drafts only after sendMessage resolves', () => {
  const method = sendTextMessageSource();
  const sendIndex = method.indexOf('await this.chatService.sendMessage({');
  const textClearIndex = method.indexOf("this.textInput = '';");
  const draftClearIndex = method.indexOf('this.clearChatDrafts();');

  assert.ok(sendIndex >= 0, 'sendTextMessage() must await the chat send request');
  assert.ok(textClearIndex > sendIndex, 'textInput must only clear after a successful send');
  assert.ok(draftClearIndex > sendIndex, 'persisted drafts must only clear after a successful send');
});

test('preserves failed text sends instead of clearing the recoverable draft', () => {
  const method = sendTextMessageSource();
  const catchIndex = method.indexOf('} catch (e) {');
  assert.ok(catchIndex >= 0, 'sendTextMessage() must handle send failures');

  const catchBlock = method.slice(catchIndex);
  assert.doesNotMatch(
    catchBlock,
    /this\.textInput\s*=\s*['"]{2}|this\.clearChatDrafts\(\)/,
    'failed sends must not clear the composer or persisted draft',
  );
  assert.match(
    catchBlock,
    /this\.draftService\.saveChatDraft\(this\.roomId,\s*text\)/,
    'failed sends must persist the attempted text for recovery',
  );
});

test('clears reply state only after the outgoing message has been accepted', () => {
  const method = sendTextMessageSource();
  const sendIndex = method.indexOf('await this.chatService.sendMessage({');
  const replyClearIndex = method.indexOf('this.replyingTo.set(null);');

  assert.ok(replyClearIndex > sendIndex, 'reply context must survive a rejected send');
});
