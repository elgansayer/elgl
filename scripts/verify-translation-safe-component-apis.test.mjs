import assert from 'node:assert/strict';
import test from 'node:test';

import {
  scanAddedTemplateLine,
  scanGenericPrimitiveSource,
} from './verify-translation-safe-component-apis.mjs';

test('rejects newly hardcoded assistive product copy', () => {
  const failures = scanAddedTemplateLine(
    '<button aria-label="Save profile">{{ label }}</button>',
    'frontend/src/app/profile/profile.html',
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /hardcoded product\/assistive copy/);
});

test('allows translated assistive bindings', () => {
  assert.deepEqual(
    scanAddedTemplateLine(
      `<button [attr.aria-label]="'profile.save' | t">{{ 'profile.save' | t }}</button>`,
      'frontend/src/app/profile/profile.html',
    ),
    [],
  );
});

test('requires explicit evidence for intentionally untranslated static copy', () => {
  assert.deepEqual(
    scanAddedTemplateLine(
      '<button aria-label="GitHub" data-policy="translation-static-ok">GitHub</button>',
      'frontend/src/app/integrations/integrations.html',
    ),
    [],
  );
});

test('rejects common hardcoded visible button actions', () => {
  const failures = scanAddedTemplateLine(
    '<button type="button">Delete</button>',
    'frontend/src/app/account/account.html',
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /hardcoded visible button copy/);
});

test('rejects translation-key APIs coupled to I18nService in generic primitives', () => {
  const failures = scanGenericPrimitiveSource(
    `import { I18nService } from '../../i18n.service';\nreadonly labelKey = input.required<string>();`,
    'frontend/src/app/components/primitives/action-row/action-row.ts',
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /resolved semantic string/);
});

test('allows provider-agnostic semantic string inputs', () => {
  assert.deepEqual(
    scanGenericPrimitiveSource(
      `readonly label = input.required<string>();`,
      'frontend/src/app/components/primitives/action-row/action-row.ts',
    ),
    [],
  );
});
