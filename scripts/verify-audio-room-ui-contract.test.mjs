import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = join(
  root,
  'frontend/src/app/components/audio-room/audio-room.component.ts',
);
const templatePath = join(
  root,
  'frontend/src/app/components/audio-room/audio-room.component.html',
);
const viewModelPath = join(
  root,
  'frontend/src/app/components/audio-room/audio-room-view-model.ts',
);

const [component, template, viewModel] = await Promise.all([
  readFile(componentPath, 'utf8'),
  readFile(templatePath, 'utf8'),
  readFile(viewModelPath, 'utf8'),
]);

test('audio room keeps the host identity visible in the selected-room header', () => {
  assert.match(template, /audioRoom\.hostLabel/);
  assert.match(template, /room\.host\?\.display_name/);
  assert.match(template, /audioRoom\.hostFallback/);
});

test('speaker stage is a bounded semantic list with host and co-host state', () => {
  assert.match(template, /audioRoom\.speakerStage/);
  assert.match(template, /role="list"/);
  assert.match(template, /@for \(participant of stageParticipants\(\)/);
  assert.match(template, /participant\.isHost/);
  assert.match(template, /participant\.isCoHost/);
  assert.match(template, /stageOverflowCount\(\)/);

  assert.match(viewModel, /MAX_RENDERED_STAGE_PARTICIPANTS = 24/);
  assert.match(viewModel, /addOrderedId\(hostId\)/);
  assert.match(viewModel, /addOrderedId\(coHostId\)/);
  assert.match(viewModel, /!byId\.has\(hostId\)/);
});

test('listener audience is bounded and does not invent listener identities', () => {
  assert.match(template, /audioRoom\.listenerAudience/);
  assert.match(template, /audiencePlaceholderAvatars\(\)/);
  assert.match(template, /audienceOverflowCount\(\)/);
  assert.match(template, /role="listitem"/);

  assert.match(viewModel, /MAX_VISIBLE_AUDIENCE_SEATS = 8/);
  assert.match(viewModel, /MAX_AUDIENCE_COUNT = 10_000/);
  assert.match(viewModel, /Listener identities are intentionally not inferred/);
  assert.doesNotMatch(viewModel, /display_name:\s*`Listener/);
});

test('component derives stage and audience state from the shared view-model helpers', () => {
  assert.match(component, /buildStageViewModel/);
  assert.match(component, /normaliseAudienceCount/);
  assert.match(component, /buildAudienceSeatIndexes/);
  assert.match(component, /readonly stageViewModel = computed/);
  assert.match(component, /readonly audienceCount = computed/);
});

test('room layout preserves mobile-first reflow and deliberate desktop composition', () => {
  assert.match(template, /grid grid-cols-1 gap-4 lg:grid-cols-3/);
  assert.match(template, /grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4/);
  assert.match(template, /flex flex-wrap gap-1\.5/);
  assert.doesNotMatch(template, /\b(left|right)-(?:0|1|2|3|4|5|6|8|10|12)\b/);
});

test('important room actions remain labelled Spartan or Relay controls', () => {
  assert.match(template, /hlmBtn/);
  assert.match(template, /audioRoom\.raiseHandBtn/);
  assert.match(template, /audioRoom\.leaveBtn/);
  assert.match(template, /audioRoom\.endArchiveBtn/);
  assert.match(template, /\[attr\.aria-label\]/);
});
