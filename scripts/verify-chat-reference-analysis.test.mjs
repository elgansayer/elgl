import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_REFERENCE_FILES,
  validateDocument,
  validateInventory,
} from './verify-chat-reference-analysis.mjs';

const validDocument = `
${CHAT_REFERENCE_FILES.join('\n')}
## Evidence and corpus scope
## Reference chat search flow
## Chat-room visual contract
## ELGL parity decisions
## Accessibility and internationalisation
## Privacy and security
## Performance and failure handling
## Verification and maintenance
`;

test('accepts the documented chat reference inventory and duplicate alias', () => {
  const hashByName = new Map([
    ['Screenshot_20260722_012546.png', 'a'],
    ['Screenshot_20260722_012551.png', 'b'],
    ['Screenshot_20260722_012559.png', 'c'],
    ['Screenshot_20260722_012559-1.png', 'c'],
  ]);

  assert.deepEqual(validateInventory(CHAT_REFERENCE_FILES, hashByName), []);
  assert.deepEqual(validateDocument(validDocument), []);
});

test('fails when a referenced screenshot disappears', () => {
  const files = CHAT_REFERENCE_FILES.filter((file) => file !== 'Screenshot_20260722_012551.png');
  const errors = validateInventory(files, new Map());

  assert.equal(errors.length, 1);
  assert.match(errors[0], /012551/);
});

test('fails when the known -1 alias stops being byte-identical', () => {
  const hashByName = new Map([
    ['Screenshot_20260722_012546.png', 'a'],
    ['Screenshot_20260722_012551.png', 'b'],
    ['Screenshot_20260722_012559.png', 'c'],
    ['Screenshot_20260722_012559-1.png', 'changed'],
  ]);
  const errors = validateInventory(CHAT_REFERENCE_FILES, hashByName);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /byte-identical alias/);
});

test('fails when evidence or maintenance sections are removed from the analysis', () => {
  const incomplete = validDocument.replace('## Privacy and security', '');
  const errors = validateDocument(incomplete);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /Privacy and security/);
});
