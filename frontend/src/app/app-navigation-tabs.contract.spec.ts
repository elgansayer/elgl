import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(resolve(process.cwd(), 'src/app/app.component.html'), 'utf8');

function mobileNavigationTemplate(): string {
  const start = template.indexOf('<!-- Mobile Bottom Navigation Bar -->');
  const end = template.indexOf('<!-- Incoming Call Modal -->');

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return template.slice(start, end);
}

describe('primary mobile navigation contract', () => {
  it('renders the five primary frontend destinations in order', () => {
    const navigation = mobileNavigationTemplate();
    const routes = [...navigation.matchAll(/routerLink="([^"]+)"/g)].map((match) => match[1]);

    expect(routes).toEqual(['/chat', '/moments', '/discovery', '/audio-rooms', '/profile']);
    expect(navigation).toContain('lg:hidden');
    expect(navigation).toContain("[attr.aria-label]=\"'nav.mainNav' | t\"");
  });

  it('binds every primary tab to UnreadCounterService state', () => {
    const navigation = mobileNavigationTemplate();

    for (const tab of ['chat', 'moments', 'discovery', 'audioRooms', 'profile'] as const) {
      expect(navigation).toContain(`unreadCounter.tabCount('${tab}')`);
      expect(navigation).toContain(`unreadCounter.badgeText('${tab}')`);
    }
  });

  it('keeps native route links and active-page semantics on every tab', () => {
    const navigation = mobileNavigationTemplate();
    const activePageBindings = navigation.match(/ariaCurrentWhenActive="page"/g) ?? [];

    expect(activePageBindings).toHaveLength(5);
    expect(navigation).not.toContain('role="button"');
    expect(navigation).not.toContain('tabindex="0"');
  });

  it('does not regress to unrelated audio-room co-host controls', () => {
    const navigation = mobileNavigationTemplate();

    expect(navigation).not.toMatch(/inviteCoHost|removeCoHost|co-?host/i);
  });
});
