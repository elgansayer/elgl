import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const shellTemplate = readFileSync(resolve(process.cwd(), 'src/app/app.component.html'), 'utf8');
const shellComponent = readFileSync(resolve(process.cwd(), 'src/app/app.component.ts'), 'utf8');

describe('call audio status shell registration', () => {
  it('mounts the banner exactly once in the app shell so every call and room page gets it', () => {
    expect(shellTemplate.match(/<app-call-audio-status\s*\/>/g)).toHaveLength(1);
  });

  it('mounts the banner ahead of the routed page so it can overlay any screen', () => {
    expect(shellTemplate.indexOf('<app-call-audio-status')).toBeGreaterThan(-1);
    expect(shellTemplate.indexOf('<app-call-audio-status')).toBeLessThan(
      shellTemplate.indexOf('<router-outlet'),
    );
  });

  it('imports the banner into the shell component so the selector resolves', () => {
    expect(shellComponent).toContain(
      "from './components/call-audio-status/call-audio-status.component'",
    );
    expect(shellComponent).toMatch(/imports:\s*\[[\s\S]*\bCallAudioStatusComponent\b[\s\S]*\]/);
  });
});
