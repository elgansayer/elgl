/**
 * RTL Logical CSS Property Verification for Virtual Coin Economy
 *
 * Verifies that all coin economy, shop, gift, escrow, VIP, sticker,
 * quest, cart, and tipping components exclusively use RTL-aware
 * logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e, etc.)
 * and never use physical direction properties.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PHYSICAL_CLASS_REGEX = /\b(pl-|pr-|ml-|mr-|left-|right-|border-l\b|border-r\b|text-left|text-right|float-left|float-right|rounded-l\b|rounded-r\b)/g;
const PHYSICAL_STYLE_INLINE_REGEX = /\b(margin-left|margin-right|padding-left|padding-right|border-left\b|border-right\b)\s*:/gi;

const LOGICAL_CLASS_REGEX = /\b(ps-|pe-|ms-|me-|border-s\b|border-e\b|text-start|text-end|float-start|float-end)/g;

/** All frontend paths related to Virtual Coin Economy features. */
const COIN_ECONOMY_PATHS = [
  'src/app/components/coin-economy-dashboard',
  'src/app/components/coins-cancel',
  'src/app/components/coins-success',
  'src/app/components/escrow-payments',
  'src/app/components/gift-animation-overlay',
  'src/app/components/gift-picker',
  'src/app/components/quests',
  'src/app/components/shop',
  'src/app/components/sticker-store',
  'src/app/components/tip-host-modal',
  'src/app/components/cart',
  'src/app/components/virtual-gift-modal',
  'src/app/components/daily-login-modal',
  'src/app/components/host-dashboard',
  'src/app/components/subscription-plans',
  'src/app/components/subscription-cancel',
  'src/app/components/subscription-success',
  'src/app/components/restore-purchases-button',
  'src/app/pages/escrow',
  'src/app/pages/escrow-detail',
  'src/app/pages/vip',
  'src/app/pages/vip-subscription',
  'src/app/pages/my-subscription',
  'src/app/pages/subscription',
  'src/app/services/economy.store.ts',
  'src/app/services/economy-error-handler.service.ts',
  'src/app/services/escrow.service.ts',
  'src/app/services/escrow-offline.service.ts',
  'src/app/services/escrow-onboarding.service.ts',
  'src/app/services/coin-economy-onboarding.service.ts',
  'src/app/services/gift-animation.service.ts',
  'src/app/services/host-dashboard.service.ts',
  'src/app/services/monetisation.service.ts',
  'src/app/services/offline-economy.service.ts',
  'src/app/services/quests.store.ts',
  'src/app/services/restore-purchases.service.ts',
  'src/app/services/subscription.service.ts',
  'src/app/services/subscription-plans.service.ts',
  'src/app/chat/sticker-picker',
  'src/app/components/sticker-picker',
  'src/app/services/offline-admin-storage.service.ts',
  'src/app/components/celebration-overlay',
  'src/app/components/streak-congratulations',
];

const TEMPLATE_EXTS = new Set(['.html', '.ts', '.scss', '.css']);

function collectFiles(rootPath: string): string[] {
  const files: string[] = [];

  if (!existsSync(rootPath)) return files;

  const stat = statSync(rootPath);
  if (stat.isFile() && TEMPLATE_EXTS.has(extname(rootPath))) {
    if (rootPath.endsWith('.spec.ts')) return [];
    return [rootPath];
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(rootPath)) {
      files.push(...collectFiles(join(rootPath, entry)));
    }
  }
  return files.filter((f) => {
    if (!TEMPLATE_EXTS.has(extname(f))) return false;
    if (f.endsWith('.spec.ts')) return false;
    return true;
  });
}

describe('RTL Logical CSS Properties - Virtual Coin Economy', () => {
  let allContent: string;

  beforeAll(() => {
    const allFiles: string[] = [];
    for (const p of COIN_ECONOMY_PATHS) {
      allFiles.push(...collectFiles(p));
    }
    // Deduplicate
    const uniqueFiles = [...new Set(allFiles)];
    allContent = uniqueFiles
      .map((f) => {
        try {
          return readFileSync(f, 'utf-8');
        } catch {
          return '';
        }
      })
      .join('\n');
  });

  it('should use logical direction utilities (ps-/pe-/ms-/me-/border-s/border-e) in coin economy templates', () => {
    const logicalMatches = allContent.match(LOGICAL_CLASS_REGEX) ?? [];
    expect(logicalMatches.length).toBeGreaterThan(0);
  });

  it('should not contain physical direction Tailwind classes (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r) in coin economy templates', () => {
    const violations: string[] = [];
    const physicalMatches = allContent.match(PHYSICAL_CLASS_REGEX);
    if (physicalMatches) {
      violations.push(...physicalMatches);
    }
    expect(violations).toEqual([]);
  });

  it('should not contain physical CSS direction properties (margin-left, margin-right, padding-left, padding-right, border-left, border-right) in inline styles', () => {
    const matches = allContent.match(PHYSICAL_STYLE_INLINE_REGEX);
    expect(matches ?? []).toEqual([]);
  });
});