import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(resolve(process.cwd(), 'src/app/app.component.html'), 'utf8');
const desktopTemplate = readFileSync(
  resolve(process.cwd(), 'src/app/components/desktop-sidebar/desktop-sidebar.component.html'),
  'utf8',
);
const desktopComponent = readFileSync(
  resolve(process.cwd(), 'src/app/components/desktop-sidebar/desktop-sidebar.component.ts'),
  'utf8',
);

const PRIMARY_TABS = ['chat', 'moments', 'discovery', 'audioRooms', 'profile'] as const;

function mobileNavigationTemplate(): string {
  const start = template.indexOf('<!-- Mobile Bottom Navigation Bar -->');
  const end = template.indexOf('<!-- Incoming Call Modal -->');

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return template.slice(start, end);
}

function topBarTemplate(): string {
  const start = template.indexOf('<!-- Top Bar with Theme Selector -->');
  const end = template.indexOf('<app-toast />');

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return template.slice(start, end);
}

describe('primary navigation unread contract', () => {
  it('renders the five primary mobile destinations in order', () => {
    const navigation = mobileNavigationTemplate();
    const routes = [...navigation.matchAll(/routerLink="([^"]+)"/g)].map((match) => match[1]);

    expect(routes).toEqual(['/chat', '/moments', '/discovery', '/audio-rooms', '/profile']);
    expect(navigation).toContain('lg:hidden');
    expect(navigation).toContain("[attr.aria-label]=\"'nav.mainNav' | t\"");
  });

  it('binds every mobile tab to the shared UnreadCounterService state', () => {
    const navigation = mobileNavigationTemplate();

    for (const tab of PRIMARY_TABS) {
      expect(navigation).toContain(`unreadCounter.tabCount('${tab}')`);
      expect(navigation).toContain(`unreadCounter.badgeText('${tab}')`);
    }
  });

  it('renders a top-level notification badge from totalUnread()', () => {
    const topBar = topBarTemplate();

    expect(topBar).toContain('routerLink="/notifications"');
    expect(topBar).toContain('@if (unreadCounter.totalUnread() > 0)');
    expect(topBar).toContain(
      "unreadCounter.totalUnread() > 99 ? '99+' : unreadCounter.totalUnread()",
    );
  });

  it('keeps the total unread badge visually hidden when there is no unread activity', () => {
    const topBar = topBarTemplate();
    const totalUnreadCondition = '@if (unreadCounter.totalUnread() > 0)';
    const totalUnreadBadge = topBar.slice(topBar.indexOf(totalUnreadCondition));

    expect(topBar.indexOf(totalUnreadCondition)).toBeGreaterThanOrEqual(0);
    expect(totalUnreadBadge).toContain('bg-danger');
    expect(totalUnreadBadge).toContain('text-on-fill');
    expect(totalUnreadBadge).toContain('min-w-[18px]');
  });

  it('binds desktop navigation badges to the same shared service', () => {
    expect(desktopTemplate).toContain('unreadCounter.tabCount(item.tab)');
    expect(desktopTemplate).toContain('unreadCounter.badgeText(item.tab)');
    expect(desktopTemplate).toContain('ariaCurrentWhenActive="page"');

    for (const tab of PRIMARY_TABS) {
      expect(desktopComponent).toContain(`tab: '${tab}'`);
    }
  });

  it('keeps native route links and active-page semantics on every mobile tab', () => {
    const navigation = mobileNavigationTemplate();
    const activePageBindings = navigation.match(/ariaCurrentWhenActive="page"/g) ?? [];

    expect(activePageBindings).toHaveLength(5);
    expect(navigation).not.toContain('role="button"');
    expect(navigation).not.toContain('tabindex="0"');
  });

  it('keeps unread text available to assistive technology on desktop and mobile', () => {
    const navigation = mobileNavigationTemplate();

    for (const tab of PRIMARY_TABS) {
      expect(navigation).toContain(`unreadCounter.tabCount('${tab}')`);
    }
    expect(desktopTemplate).toContain('unreadCounter.tabCount(item.tab)');
    expect(desktopTemplate).toContain('class="sr-only"');
  });

  it('does not regress to unrelated audio-room co-host controls', () => {
    const navigation = mobileNavigationTemplate();

    expect(navigation).not.toMatch(/inviteCoHost|removeCoHost|co-?host/i);
    expect(desktopTemplate).not.toMatch(/inviteCoHost|removeCoHost|co-?host/i);
  });
});
