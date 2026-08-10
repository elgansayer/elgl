import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('ModerationQueueComponent', () => {
  describe('RTL logical CSS compliance', () => {
    let templateContent: string;

    beforeAll(() => {
      templateContent = readFileSync(
        resolve(__dirname, 'moderation-queue.component.html'),
        'utf-8',
      );
    });

    it('should not contain any physical direction CSS utilities', () => {
      const violations = [
        /\bpl-\d/,
        /\bpr-\d/,
        /\bml-\d/,
        /\bmr-\d/,
        /\bleft-[0-9]/,
        /\bright-[0-9]/,
        /\bborder-l\b/,
        /\bborder-r\b/,
        /\btext-left\b/,
        /\btext-right\b/,
      ];
      for (const pattern of violations) {
        expect(templateContent).not.toMatch(pattern);
      }
    });

    it('should use border utilities without physical directions (RTL safe)', () => {
      expect(templateContent).toContain('border');
    });

    it('should use logical flex layout properties', () => {
      expect(templateContent).toContain('flex');
      expect(templateContent).toContain('justify-between');
    });

    it('should use i18n translate pipe for user-facing strings', () => {
      const keys = [
        'moderation.title',
        'moderation.filterAria',
        'moderation.moment',
        'moderation.profile',
        'moderation.approveAria',
        'moderation.rejectAria',
        'moderation.approve',
        'moderation.reject',
        'moderation.reported_user',
        'moderation.reporter',
        'moderation.reportItemAria',
        'safety.moderation.emptyTitle',
        'safety.moderation.emptyDesc',
      ];
      for (const key of keys) {
        expect(templateContent).toContain("'" + key + "'");
      }
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toMatch(/>Approve</);
      expect(templateContent).not.toMatch(/Reject/);
      expect(templateContent).not.toMatch(/Reporter/);
      expect(templateContent).not.toMatch(/Reported User/);
      expect(templateContent).not.toMatch(/No items to review/);
      expect(templateContent).not.toMatch(/Loading/);
    });
  });
});
