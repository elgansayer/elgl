import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const templateUrl = new URL(
  '../frontend/src/app/components/moments-feed/moments-feed.component.html',
  import.meta.url,
);
const auditUrl = new URL('../docs/moments-accessibility-audit.md', import.meta.url);

const template = readFileSync(templateUrl, 'utf8');
const audit = readFileSync(auditUrl, 'utf8');

function buttonFor(clickExpression) {
  const buttons = [...template.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((match) => match[0]);
  const button = buttons.find((candidate) => candidate.includes(`(click)="${clickExpression}"`));
  assert.ok(button, `Expected button for ${clickExpression}`);
  return button;
}

test('Moments exposes a single primary landmark and translated top-level navigation names', () => {
  assert.equal((template.match(/<main\b/g) ?? []).length, 1, 'Moments should expose one main landmark');
  assert.equal((template.match(/<h1\b/g) ?? []).length, 1, 'Moments should expose one page heading');
  assert.match(template, /\[attr\.aria-label\]="'nav\.profile' \| t"/);
  assert.match(template, /\[attr\.aria-label\]="'nav\.notifications' \| t"/);
  assert.match(template, /\[attr\.aria-label\]="'nav\.compose' \| t"/);
});

test('Moment image lightbox controls have localized names and decorative duplicate image alts', () => {
  assert.match(template, /'lightbox\.imageAlt'\s*\| t:/);
  assert.match(template, /<img \[src\]="url"[^>]*alt=""[^>]*>/);
});

test('Moments avoids synthetic button semantics and positive tabindex', () => {
  assert.doesNotMatch(template, /role="button"/);
  assert.doesNotMatch(template, /tabindex="[1-9][0-9]*"/);
});

test('the accessibility audit records the exact current high-priority debt', () => {
  const removeMedia = buttonFor('removeMedia(i)');
  const recordVoice = buttonFor('showVoiceRecorder.set(true)');
  const likedBy = buttonFor('openLikedBy(moment)');
  const submitComment = buttonFor('submitComment(moment)');

  const findings = [
    {
      id: 'MOM-A11Y-001',
      present: removeMedia.includes('aria-label="Remove media"'),
    },
    {
      id: 'MOM-A11Y-002',
      present: recordVoice.includes('aria-label="Record voice"'),
    },
    {
      id: 'MOM-A11Y-003',
      present: (template.match(/\\[attr\\.aria-label\\]=\"'text input'\"/g) ?? []).length === 2,
    },
    {
      id: 'MOM-A11Y-004',
      present: !likedBy.includes('aria-label') && !likedBy.includes('[attr.aria-label]'),
    },
    {
      id: 'MOM-A11Y-005',
      present: removeMedia.includes('h-5 w-5') && submitComment.includes('h-8 w-8'),
    },
    {
      id: 'MOM-A11Y-006',
      present: submitComment.includes('aria-label=\"Submit comment\"'),
    },
    {
      id: 'MOM-A11Y-007',
      present: template.includes('(keyup.enter)=\"submitComment(moment)\"'),
    },
  ];

  for (const finding of findings) {
    assert.equal(finding.present, true, `${finding.id} no longer matches the source; update the audit`);
    assert.match(audit, new RegExp(`\\b${finding.id}\\b`), `${finding.id} must be documented`);
  }

  const documentedFindingIds = [
    ...new Set([...audit.matchAll(/\\bMOM-A11Y-\\d{3}\\b/g)].map(([id]) => id)),
  ].sort();
  assert.deepEqual(
    documentedFindingIds,
    findings.map(({ id }) => id).sort(),
    'The documented and executable accessibility debt baselines must match',
  );
});

test('the audit covers screen-reader, keyboard, zoom, RTL, privacy, and rollback review', () => {
  for (const heading of [
    'Screen-reader review',
    'Keyboard and input-method review',
    'Zoom and reflow review',
    'RTL and localisation review',
    'Privacy and security review',
    'Rollout and rollback',
  ]) {
    assert.ok(audit.includes(`## ${heading}`), `Missing audit section: ${heading}`);
  }
});
