import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const chatService = readFileSync('frontend/src/app/services/chat.service.ts', 'utf8');
const chatCacheService = readFileSync('frontend/src/app/services/chat-cache.service.ts', 'utf8');
const cacheDocs = readFileSync('docs/chat-cache.md', 'utf8');

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('ChatService owns an actual ChatCacheService integration', () => {
  assert.match(chatService, /import \{ ChatCacheService \} from '\.\/chat-cache\.service';/);
  assert.match(chatService, /private chatCache = inject\(ChatCacheService\);/);
});

test('normal message loads are cache-first and network responses warm the canonical room snapshot', () => {
  const getMessages = section(chatService, 'async getMessages(', 'async getRooms(');

  assert.match(getMessages, /if \(!hasSearch\)[\s\S]*getCachedMessages\(roomId\)/);
  assert.match(getMessages, /http\.get<ChatMessage\[\]>\(`\$\{this\.baseUrl\}\/messages\/\$\{roomId\}`/);
  assert.match(getMessages, /if \(!hasSearch\)[\s\S]*cacheMessages\(roomId, messages\)/);
});

test('search results bypass the room cache so partial result sets cannot poison canonical snapshots', () => {
  const getMessages = section(chatService, 'async getMessages(', 'async getRooms(');

  assert.match(getMessages, /const hasSearch = search && search\.trim\(\)\.length > 0;/);
  assert.match(getMessages, /if \(hasSearch\)[\s\S]*params = params\.set\('search', search!\.trim\(\)\);/);
  assert.equal((getMessages.match(/if \(!hasSearch\)/g) ?? []).length, 2);
});

test('room loads and successful sends keep their cache entries warm', () => {
  const getRooms = section(chatService, 'async getRooms(', '/**\n   * Sends a reply to a status update');
  const sendMessage = section(chatService, 'async sendMessage(', '/** Attempt to sync all offline queued messages.');

  assert.match(getRooms, /getCachedRooms\(\)/);
  assert.match(getRooms, /cacheRooms\(rooms\)/);
  assert.match(sendMessage, /appendCachedMessage\(payload\.room_id, message\)/);
});

test('private cache data is account-scoped, bounded and expires instead of becoming authoritative storage', () => {
  assert.match(chatCacheService, /const CACHE_KEY_VERSION = 'v2';/);
  assert.match(chatCacheService, /this\.authService\.currentUser\(\)\?\.id\?\.trim\(\)/);
  assert.match(chatCacheService, /MAX_MESSAGES_PER_ROOM = 500/);
  assert.match(chatCacheService, /MAX_ROOMS = 250/);
  assert.match(chatCacheService, /MAX_FAVOURITES = 500/);
  assert.match(chatCacheService, /MESSAGES_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(chatCacheService, /OFFLINE_RETENTION_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(chatCacheService, /Cache availability must never prevent chat from falling back to the network/);
});

test('the production runbook documents privacy, failure and rollback behavior', () => {
  assert.match(cacheDocs, /## Account isolation/);
  assert.match(cacheDocs, /## Freshness and offline behavior/);
  assert.match(cacheDocs, /## Failure handling/);
  assert.match(cacheDocs, /## Privacy and retention/);
  assert.match(cacheDocs, /## Rollout and rollback/);
});
