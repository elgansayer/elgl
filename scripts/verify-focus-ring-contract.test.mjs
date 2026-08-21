#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = execFileSync(process.execPath, [resolve(root, 'scripts/verify-focus-ring-contract.mjs')], { cwd: root, encoding: 'utf8' });
if (!output.includes('Focus ring contract verified.')) throw new Error('Focus ring verifier did not report success');
console.log('Focus ring verifier smoke test passed.');
