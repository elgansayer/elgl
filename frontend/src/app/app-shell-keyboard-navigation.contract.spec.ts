import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appTemplate = readFileSync(resolve(process.cwd(), 'src/app/app.component.html'), 'utf8');
const desktopTemplate = readFileSync(
  resolve(process.cwd(), 'src/app/components/desktop-sidebar/desktop-sidebar.component.html'),
  'utf8',
);
const mobileTemplate = readFileSync(
  resolve(process.cwd(), 'src/app/components/mobile-navigation/mobile-navigation.component.html'),
  'utf8',
);

const SKIP_LINK_MARKER = 'href="#main-content"';
const TOP_BAR_MARKER = '<!-- Top Bar with Theme Selector -->';

function mainLandmarkTag(): string {
  const start = appTemplate.indexOf('<main');
  const end = appTemplate.indexOf('>', start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return appTemplate.slice(start, end + 1);
}

describe('desktop keyboard tab-navigation contract', () => {
  it('places the skip link before every other focusable shell control', () => {
    const skipLinkIndex = appTemplate.indexOf(SKIP_LINK_MARKER);
    const topBarIndex = appTemplate.indexOf(TOP_BAR_MARKER);
    const firstSidebarIndex = appTemplate.indexOf('<app-desktop-sidebar');

    expect(skipLinkIndex).toBeGreaterThanOrEqual(0);
    expect(topBarIndex).toBeGreaterThan(skipLinkIndex);
    expect(firstSidebarIndex).toBeGreaterThan(skipLinkIndex);
    expect(appTemplate).toContain("{{ 'a11y.skipToContent' | t }}");
  });

  it('does not expose the skip link behind the app-lock dialog', () => {
    expect(appTemplate).toMatch(
      /@if \(!authService\.appLocked\(\)\) \{[\s\S]*?href="#main-content"[\s\S]*?<\/a>\s*\}/,
    );
  });

  it('moves sequential focus onto the main landmark when the skip link is activated', () => {
    const main = mainLandmarkTag();

    expect(main).toContain('id="main-content"');
    expect(main).toContain('tabindex="-1"');
  });

  it('removes the mobile tab bar from the desktop tab order', () => {
    expect(mobileTemplate).toContain('lg:hidden');
    expect(desktopTemplate).toContain('hidden lg:flex');
  });

  it('keeps desktop and mobile navigation on native, sequentially focusable anchors', () => {
    for (const template of [desktopTemplate, mobileTemplate]) {
      expect(template).toContain('routerLink=');
      expect(template).not.toMatch(/\btabindex\s*=\s*["']-1["']/);
      expect(template).not.toMatch(/\btabindex\s*=\s*["'](?:[1-9]\d*)["']/);
    }
  });

  it('exposes a labelled desktop navigation landmark beside the single main landmark', () => {
    expect(appTemplate.match(/<main\b/g)).toHaveLength(1);
    expect(desktopTemplate).toContain('role="navigation"');
    expect(desktopTemplate).toContain('[attr.aria-label]="\'nav.mainNav\' | t"');
  });
});
