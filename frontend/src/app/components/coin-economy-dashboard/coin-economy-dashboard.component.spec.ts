import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * RTL Logical CSS Properties Verification for Virtual Coin Economy Dashboard.
 *
 * Issue #2411: Verify RTL logical CSS properties (ps-, pe-) for the
 * Virtual Coin Economy architecture to ensure production readiness.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENT_SOURCE = readFileSync(
  resolve(__dirname, './coin-economy-dashboard.component.ts'),
  'utf-8',
);

// Extract inline template between template: ` and `,\n})
const templateMatch = COMPONENT_SOURCE.match(/template:\s*`([\s\S]*?)`,\n\}\)/);
const TEMPLATE = templateMatch ? templateMatch[1] : '';

describe('CoinEconomyDashboard RTL Logical CSS Audit (ps-, pe-)', () => {
  it('should have a non-empty inline template', () => {
    expect(TEMPLATE.length).toBeGreaterThan(100);
    expect(TEMPLATE).toContain('class=');
  });

  it('should use ps-4 pe-4 on all major sections', () => {
    expect(TEMPLATE).toMatch(/ps-4 pe-4/);
    const matches = TEMPLATE.match(/ps-4 pe-4/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('should use md:ps-8 md:pe-8 for tablet breakpoints', () => {
    expect(TEMPLATE).toMatch(/md:ps-8 md:pe-8/);
    const matches = TEMPLATE.match(/md:ps-8 md:pe-8/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('should NOT use physical pl- classes', () => {
    expect(TEMPLATE).not.toMatch(/\bpl-\d/);
    expect(TEMPLATE).not.toMatch(/\bpl-\[/);
  });

  it('should NOT use physical pr- classes', () => {
    expect(TEMPLATE).not.toMatch(/\bpr-\d/);
    expect(TEMPLATE).not.toMatch(/\bpr-\[/);
  });

  it('should NOT use physical ml-, mr- classes', () => {
    expect(TEMPLATE).not.toMatch(/\bml-\d/);
    expect(TEMPLATE).not.toMatch(/\bmr-\d/);
  });

  it('should NOT use physical border-l, border-r', () => {
    expect(TEMPLATE).not.toMatch(/\bborder-l\b/);
    expect(TEMPLATE).not.toMatch(/\bborder-r\b/);
  });

  it('should NOT use physical left-, right- position', () => {
    expect(TEMPLATE).not.toMatch(/\bleft-\d/);
    expect(TEMPLATE).not.toMatch(/\bright-\d/);
  });

  it('should NOT use CSS physical direction properties', () => {
    expect(TEMPLATE).not.toMatch(/margin-left\s*:/);
    expect(TEMPLATE).not.toMatch(/margin-right\s*:/);
    expect(TEMPLATE).not.toMatch(/padding-left\s*:/);
    expect(TEMPLATE).not.toMatch(/padding-right\s*:/);
    expect(TEMPLATE).not.toMatch(/border-left\s*:/);
    expect(TEMPLATE).not.toMatch(/border-right\s*:/);
  });

  it('should use Angular @if/@for control flow', () => {
    expect(TEMPLATE).toContain('@if');
    expect(TEMPLATE).toContain('@for');
    expect(TEMPLATE).not.toMatch(/\*ngIf/);
    expect(TEMPLATE).not.toMatch(/\*ngFor/);
    expect(TEMPLATE).not.toMatch(/\*ngSwitch/);
  });

  it('should use flex/grid with items-center for RTL-safe layout', () => {
    expect(TEMPLATE).toContain('flex');
    expect(TEMPLATE).toContain('grid');
    expect(TEMPLATE).toContain('items-center');
  });

  it('should use TranslatePipe (| t) for i18n', () => {
    expect(TEMPLATE).toContain('| t');
  });

  it('should use logical properties consistently for header, actions, and activity', () => {
    // Verify all section-type elements use logical padding
    const sectionPsMatches = TEMPLATE.match(/\bps-\d/g);
    const sectionPeMatches = TEMPLATE.match(/\bpe-\d/g);
    expect(sectionPsMatches).not.toBeNull();
    expect(sectionPeMatches).not.toBeNull();
    // Should have more logical than physical direction classes (zero physical)
    expect(sectionPsMatches!.length).toBeGreaterThan(0);
    expect(sectionPeMatches!.length).toBeGreaterThan(0);
  });
});

describe('CoinEconomyDashboard Spartan interaction ownership', () => {
  it('should compose every button and action link with the Spartan button primitive', () => {
    const interactiveElements = TEMPLATE.match(/<(?:button|a)\b[\s\S]*?>/g) ?? [];

    expect(interactiveElements).toHaveLength(8);
    for (const element of interactiveElements) {
      expect(element).toMatch(/\bhlmBtn\b/);
    }
  });

  it('should preserve native anchor navigation for all quick actions', () => {
    const quickActionLinks = TEMPLATE.match(/<a\b[\s\S]*?>/g) ?? [];
    const routes = ['/vip', '/chat', '/sticker-store', '/shop', '/vip', '/escrow'];

    expect(quickActionLinks).toHaveLength(routes.length);
    for (const [index, link] of quickActionLinks.entries()) {
      expect(link).toContain('hlmBtn');
      expect(link).toContain(`routerLink="${routes[index]}"`);
      expect(link).not.toContain('role="button"');
      expect(link).not.toContain('tabindex=');
    }
  });
});
