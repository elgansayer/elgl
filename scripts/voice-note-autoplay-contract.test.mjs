import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/20260808000259_add_auto_play_voice_notes_column.sql',
);
const profileInterface = read('backend/src/users/interfaces/user-profile.interface.ts');
const settingsComponent = read('frontend/src/app/components/settings/settings.component.ts');
const settingsTemplate = read('frontend/src/app/components/settings/settings.component.html');
const chatRoomComponent = read('frontend/src/app/components/chat-room/chat-room.component.ts');
const chatRoomTemplate = read('frontend/src/app/components/chat-room/chat-room.component.html');
const autoplaySpec = read(
  'frontend/src/app/components/chat-room/chat-room.voice-autoplay.spec.ts',
);

test('persists an explicit opt-in preference with an off-by-default schema', () => {
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS auto_play_voice_notes boolean DEFAULT false;/,
  );
  assert.match(profileInterface, /auto_play_voice_notes\?: boolean;/);
});

test('settings exposes and persists the translated auto-play toggle', () => {
  assert.match(settingsTemplate, /settings\.autoPlayVoiceNotes/);
  assert.match(settingsTemplate, /<hlm-checkbox[\s\S]*?autoPlayVoiceNotes\(\)/);
  assert.match(
    settingsTemplate,
    /\(ngModelChange\)="autoPlayVoiceNotes\.set\(\$event\)"/,
  );
  assert.match(
    settingsComponent,
    /autoPlayVoiceNotes\.set\(Boolean\(profile\.auto_play_voice_notes\)\)/,
  );
  assert.match(
    settingsComponent,
    /auto_play_voice_notes:\s*this\.autoPlayVoiceNotes\(\)/,
  );
});

test('chat loads the persisted preference and only chains playback when enabled', () => {
  assert.match(chatRoomComponent, /readonly autoPlayVoiceNotes = signal\(false\);/);
  assert.match(chatRoomComponent, /await this\.loadAutoPlayPreference\(\);/);
  assert.match(
    chatRoomComponent,
    /this\.autoPlayVoiceNotes\.set\(Boolean\(profile\?\.auto_play_voice_notes\)\)/,
  );
  assert.match(
    chatRoomComponent,
    /async playNextVoiceNote\(currentMessageId: string\): Promise<void> \{[\s\S]*?if \(!this\.autoPlayVoiceNotes\(\)\) return;/,
  );
  assert.match(
    chatRoomComponent,
    /nextMsg\.message_type === 'voice' && nextMsg\.media_url/,
  );
  assert.match(chatRoomTemplate, /\(ended\)="playNextVoiceNote\(msg\.id\)"/);
});

test('sequential playback regression coverage stays enabled', () => {
  assert.doesNotMatch(autoplaySpec, /describe\.skip\(/);
  assert.match(autoplaySpec, /loads the persisted autoplay preference/);
  assert.match(autoplaySpec, /plays the next playable voice note after the current note ends/);
  assert.match(autoplaySpec, /does not start another note while autoplay is disabled/);
  assert.match(autoplaySpec, /browser autoplay policy rejects the next playback/);
});
