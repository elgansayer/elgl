import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [draftService, draftSpec, chatRoom, momentsFeed] = await Promise.all([
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

test('ChatRoom persists compose state and clears it only after successful sends', () => {
  assert.match(chatRoom, /private readonly draftService = inject\(DraftService\)/);
  assert.match(chatRoom, /private async finishLoadingRoom\(\)[\s\S]*?this\.restoreDraft\(\)/);
  assert.match(chatRoom, /ngOnDestroy\(\)[\s\S]*?this\.saveChatDrafts\(\)/);
  assert.match(chatRoom, /onComposerInput\(event: Event\)[\s\S]*?this\.saveChatDrafts\(\)/);
  assert.match(chatRoom, /saveChatDraftV2\(this\.roomId,[\s\S]*?replyToId:/);
  assert.match(chatRoom, /await this\.chatService\.sendMessage\([\s\S]*?this\.clearChatDrafts\(\)/);
  assert.match(
    chatRoom,
    /catch \(e\) \{[\s\S]*?Failed to send text message:[\s\S]*?saveChatDraft\(this\.roomId, text\)/,
  );
});

test('Moments restores local drafts and removes them after successful publication', () => {
  assert.match(momentsFeed, /private readonly draftService = inject\(DraftService\)/);
  assert.match(momentsFeed, /afterNextRender\(\(\) => \{[\s\S]*?this\.restoreMomentDraft\(\)/);
  assert.match(momentsFeed, /this\.destroyRef\.onDestroy\([\s\S]*?this\.saveMomentDraft\(\)/);
  assert.match(
    momentsFeed,
    /await this\.momentsStore\.createMoment\([\s\S]*?this\.draftService\.clearMomentDraft\(\)/,
  );
  assert.match(momentsFeed, /text: this\.newText\(\)/);
  assert.match(momentsFeed, /mediaUrls: this\.newMediaUrls\(\)\.length/);
  assert.match(momentsFeed, /targetLanguage: this\.newTargetLanguage\(\)/);
  assert.match(momentsFeed, /voiceDurationSec: this\.newVoiceDurationSec/);
});

test('Draft regression coverage protects privacy and blocked-storage failure paths', () => {
  assert.match(draftSpec, /uses user ID in storage keys to isolate accounts on a shared browser/);
  assert.match(draftSpec, /does not break composing when localStorage writes fail/);
  assert.match(draftSpec, /fails closed when localStorage reads are blocked/);
  assert.match(draftSpec, /filters unsafe and excessive media URLs before persistence/);
  assert.match(draftSpec, /drops corrupt moment JSON so it cannot poison future loads/);
});
