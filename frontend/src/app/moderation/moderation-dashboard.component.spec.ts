import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('ModerationDashboardComponent', () => {
  describe('RTL logical CSS compliance', () => {
    let templateContent: string;

    beforeAll(() => {
      templateContent = readFileSync(
        resolve(__dirname, 'moderation-dashboard.component.html'),
        'utf-8',
      );
    });

    it('should not contain any physical direction CSS utilities', () => {
      const violations = [
        /\bpl-\d/, /\bpr-\d/, /\bml-\d/, /\bmr-\d/,
        /\bleft-[0-9]/, /\bright-[0-9]/,
        /\bborder-l\b/, /\bborder-r\b/,
        /\btext-left\b/, /\btext-right\b/,
      ];
      for (const pattern of violations) {
        expect(templateContent).not.toMatch(pattern);
      }
    });

    it('should use logical CSS utilities for inline start/end padding (ps-, pe-)', () => {
      expect(templateContent).toContain('ps-4');
      expect(templateContent).toContain('pe-4');
    });

    it('should use logical margin utility (ms-)', () => {
      expect(templateContent).toContain('ms-2');
    });

    it('should use border utilities without physical directions (RTL safe)', () => {
      expect(templateContent).toContain('border');
    });

    it('should use logical flex layout properties', () => {
      expect(templateContent).toContain('flex');
    });

    it('should use i18n translate pipe for user-facing strings', () => {
      const keys = [
        'moderation.title', 'moderation.profile', 'moderation.moment',
        'moderation.dismiss', 'moderation.reporter', 'moderation.reported_user',
        'moderation.reason', 'moderation.description', 'moderation.content',
        'moderation.approve', 'moderation.reject', 'moderation.analyse',
        'moderation.riskScore', 'moderation.noFlags', 'safety.moderation.loadError',
        'safety.moderation.loadErrorDesc', 'safety.moderation.emptyTitle',
        'safety.moderation.emptyDesc', 'common.retry',
      ];
      for (const key of keys) {
        expect(templateContent).toContain("'" + key + "'");
      }
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toContain('>Approve<');
      expect(templateContent).not.toContain('>Reject<');
      expect(templateContent).not.toContain('>Dismiss<');
      expect(templateContent).not.toContain('>Risk Score:<');
      expect(templateContent).not.toContain('>No flags<');
    });
  });
});
