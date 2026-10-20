import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('production styles do not depend on remotely hosted fonts', async () => {
  const productionFiles = await Promise.all([
    readFile(new URL('../src/styles.scss', import.meta.url), 'utf8'),
    readFile(new URL('../tailwind.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../ngsw-config.json', import.meta.url), 'utf8'),
  ]);

  for (const contents of productionFiles) {
    assert.doesNotMatch(contents, /@import\s+(?:url\()?['"]?https?:\/\//i);
    assert.doesNotMatch(contents, /fonts\.(?:googleapis|gstatic)\.com|Instrument Sans/i);
  }
});
