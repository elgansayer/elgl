import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('ReportUserModalComponent', () => {
  describe('RTL logical CSS compliance', () => {
    let templateContent: string;

    beforeAll(() => {
      templateContent = readFileSync(
        resolve(__dirname, 'report-user-modal.component.html'),
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

    it('should use logical CSS utilities for inline start padding', () => {
      expect(templateContent).toContain('ps-1');
    });

    it('should use logical CSS utilities for inline start/end margin', () => {
      expect(templateContent).toContain('ms-');
      expect(templateContent).toContain('me-');
    });

    it('should use logical pseudo-element positioning (after:start)', () => {
      expect(templateContent).toContain("after:start-[2px]");
    });

    it('should support RTL toggle switch translation', () => {
      expect(templateContent).toContain('rtl:peer-checked:after:-translate-x-full');
    });

    it('should use i18n translate pipe for all user-facing strings', () => {
      const keys = [
        "'report.title'",
        "'report.close'",
        "'report.reason_label'",
        "'report.details_label'",
        "'report.details_placeholder'",
        "'report.block_user'",
        "'report.cancel'",
        "'report.submit'",
        "'report.submitting'",
        "'report.load_error'",
        "'report.retry'",
      ];
      for (const key of keys) {
        expect(templateContent).toContain(key);
      }
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toMatch(/Report user/i);
      expect(templateContent).not.toMatch(/Submit report/i);
      expect(templateContent).not.toMatch(/Cancel/);
      expect(templateContent).not.toMatch(/Block this user/i);
      expect(templateContent).not.toMatch(/Select a reason/i);
      expect(templateContent).not.toMatch(/Additional details/i);
    });
  });
});