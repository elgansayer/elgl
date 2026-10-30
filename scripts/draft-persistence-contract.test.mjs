import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [draftService, draftSpec, chatRoom, momentsFeed, momentsTemplate] = await Promise.all([
  readFile(new URL('../frontend/src/app/services/draft.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../frontend/src/app/services/draft.service.spec.ts', import.meta.url), 'utf8'),
  readFile(
    new URL('../frontend/src/app/components/chat-room/chat-room.component.ts', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../frontend/src/app/components/moments-feed/moments-feed.component.ts', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../frontend/src/app/components/moments-feed/moments-feed.component.html', import.meta.url),
    'utf8',
  ),
]);

test('DraftService keeps local drafts bounded and scoped to the signed-in account', () => {
  assert.match(draftService, /globalThis\.localStorage/);
  assert.match(draftService, /return userId \? `ht_\$\{userId\}` : 'ht_anon'/);
  assert.match(draftService, /CHAT_DRAFT_V2_PREFIX/);
  assert.match(draftService, /MOMENT_DRAFT_KEY/);
  assert.match(draftService, /MAX_SERIALIZED_DRAFT_LENGTH = 96_000/);
  assert.match(draftService, /MAX_CHAT_TEXT_LENGTH = 10_000/);
  assert.match(draftService, /MAX_MOMENT_TEXT_LENGTH = 10_000/);
  assert.match(draftService, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/);
});

test('DraftService expires drafts and never reports their content', () => {
  assert.match(draftService, /DRAFT_RETENTION_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(draftService, /savedAt: now/);
  assert.match(draftService, /private ensureSwept\(\): void/);
  assert.match(draftService, /DRAFT_KEY_PATTERN/);
  // The only console output is one sanitised warning that carries the error name alone.
  assert.equal(draftService.match(/\bconsole\.[a-z]+\(/g)?.length, 1);
  assert.match(draftService, /console\.warn\([^)]*\{\s*reason: errorName\(error\),?\s*\}\)/s);
  assert.doesNotMatch(draftService, /\bconsole\.(log|info|debug|error)\(/);
  assert.doesNotMatch(draftService, /\bas (?:unknown|string|number|Record|any)\b/);
});

test('ChatRoom persists compose state and clears it only after successful sends', () => {
  assert.match(chatRoom, /private readonly draftService = inject\(DraftService\)/);
  assert.match(chatRoom, /private async finishLoadingRoom\(\)[\s\S]*?this\.restoreDraft\(\)/);
  assert.match(chatRoom, /ngOnDestroy\(\)[\s\S]*?this\.saveChatDrafts\(\)/);
  assert.match(chatRoom, /onComposerInput\(event: Event\)[\s\S]*?this\.saveChatDrafts\(\)/);
  assert.match(chatRoom, /saveChatDraftV2\(this\.roomId,[\s\S]*?replyToId:/);
  assert.match(chatRoom, /await this\.chatService\.sendMessage\([\s\S]*?this\.clearChatDrafts\(roomId\)/);
  assert.match(
    chatRoom,
    /catch \(e\) \{[\s\S]*?Failed to send text message:[\s\S]*?saveChatDraft\(roomId, text\)/,
  );
});

test('ChatRoom restores the draft before history loads and never saves an unrestored composer', () => {
  assert.match(
    chatRoom,
    /private async finishLoadingRoom\(\)[\s\S]*?this\.restoreDraft\(\)[\s\S]*?await this\.loadMessages\(\)/,
  );
  assert.match(chatRoom, /saveChatDrafts\(\): void \{\s*if \(!this\.canPersistDrafts\(\)\) return;/);
  assert.match(chatRoom, /private canPersistDrafts\(\): boolean/);
  assert.match(chatRoom, /scope\.userId === this\.authService\.currentUser\(\)\?\.id/);
  assert.match(chatRoom, /if \(!roomId \|\| !userId\) return;/);
});

test('ChatRoom resets the composer per room and keeps the room effect dependent on the id only', () => {
  assert.match(chatRoom, /untracked\(\(\) => this\.openRoom\(roomId\)\)/);
  assert.match(
    chatRoom,
    /private openRoom\(roomId: string\): void \{[\s\S]*?this\.saveChatDrafts\(\);[\s\S]*?this\.resetComposerState\(\);[\s\S]*?this\.draftScope = null;/,
  );
  assert.match(chatRoom, /startReply\(messageId: string\): void \{[\s\S]*?this\.saveChatDrafts\(\)/);
  assert.match(chatRoom, /cancelReply\(\): void \{[\s\S]*?this\.saveChatDrafts\(\)/);
});

test('Moments saves every change, restores after render once the account is known, and publishes once', () => {
  assert.match(momentsFeed, /private readonly draftService = inject\(DraftService\)/);
  assert.match(momentsFeed, /afterNextRender\(\(\) => \{[\s\S]*?this\.hasRendered\.set\(true\)/);
  assert.match(
    momentsFeed,
    /effect\(\(\) => \{[\s\S]*?untracked\(\(\) => this\.hydrateMomentDraft\(userId, rendered\)\)/,
  );
  assert.match(
    momentsFeed,
    /effect\(\(\) => \{\s*const draft = this\.momentDraftSnapshot\(\);\s*if \(!this\.canPersistMomentDraft\(\)\) return;\s*untracked\(\(\) => this\.draftService\.saveMomentDraft\(draft\)\)/,
  );
  assert.match(momentsFeed, /this\.destroyRef\.onDestroy\([\s\S]*?this\.saveMomentDraft\(\)/);
  assert.match(
    momentsFeed,
    /await this\.momentsStore\.createMoment\([\s\S]*?this\.draftService\.clearMomentDraft\(\)[\s\S]*?this\.showComposeForm\.set\(false\)/,
  );
  assert.match(momentsFeed, /if \(this\.isCreating\(\)\) return;/);
  assert.match(momentsFeed, /text: this\.newText\(\)/);
  assert.match(momentsFeed, /mediaUrls: this\.newMediaUrls\(\)\.length/);
  assert.match(momentsFeed, /targetLanguage: this\.newTargetLanguage\(\)/);
  assert.match(momentsFeed, /voiceDurationSec: this\.newVoiceDurationSec/);
});

test('Moments only closes the composer from the component, after publishing succeeds', () => {
  assert.match(momentsTemplate, /\(click\)="submitMoment\(\)"/);
  assert.doesNotMatch(momentsTemplate, /submitMoment\(\);\s*showComposeForm\.set\(false\)/);
});

test('Draft regression coverage protects privacy and blocked-storage failure paths', () => {
  assert.match(draftSpec, /uses user ID in storage keys to isolate accounts on a shared browser/);
  assert.match(draftSpec, /does not break composing when localStorage writes fail/);
  assert.match(draftSpec, /fails closed when localStorage reads are blocked/);
  assert.match(draftSpec, /filters unsafe and excessive media URLs before persistence/);
  assert.match(draftSpec, /drops corrupt moment JSON so it cannot poison future loads/);
  assert.match(draftSpec, /discards a chat draft that was last saved more than 30 days ago/);
  assert.match(draftSpec, /reports a failed write once, without draft content or identifiers/);
});
