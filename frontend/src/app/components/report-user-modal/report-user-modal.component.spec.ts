import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('ReportUserModalComponent', () => {
  describe('RTL logical CSS compliance', () => {
    let templateContent: string;

    beforeAll(() => {
<<<<<<< HEAD
      const content = readFileSync(
        resolve(__dirname, 'report-user-modal.component.html'),
        'utf-8',
      );
      templateContent = content;
=======
      templateContent = readFileSync(
        resolve(__dirname, 'report-user-modal.component.html'),
        'utf-8',
      );
>>>>>>> origin/main
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

<<<<<<< HEAD
    it('should use logical CSS utilities for inline start padding (ps-)', () => {
      expect(templateContent).toContain('ps-1');
    });

    it('should use logical CSS utilities for margin (me-, ms-)', () => {
      expect(templateContent).toContain('me-4');
      expect(templateContent).toContain('ms-3');
    });

    it('should use logical negative margin utility (-me-2)', () => {
      expect(templateContent).toContain('-me-2');
    });

    it('should use block axis border utilities (RTL safe)', () => {
      expect(templateContent).toMatch(/\bborder-b\b/);
      expect(templateContent).toMatch(/\bborder-t\b/);
    });

    it('should use logical flex layout properties', () => {
      expect(templateContent).toContain('flex');
      expect(templateContent).toContain('justify-between');
      expect(templateContent).toContain('justify-center');
    });

    it('should use i18n translate pipe for user-facing strings', () => {
      const keys = [
        'report.title', 'report.close', 'report.load_error',
        'report.retry', 'report.reason_label', 'report.details_label',
        'report.details_placeholder', 'report.block_user',
        'report.cancel', 'report.submitting', 'report.submit',
      ];
      for (const key of keys) {
        expect(templateContent).toContain("'" + key + "'");
=======
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
>>>>>>> origin/main
      }
    });

    it('should not hardcode English user-facing strings', () => {
<<<<<<< HEAD
      expect(templateContent).not.toMatch(/>Report User</);
      expect(templateContent).not.toMatch(/>Report</);
      expect(templateContent).not.toMatch(/Submit Report/);
      expect(templateContent).not.toMatch(/Select a reason/);
      expect(templateContent).not.toMatch(/Provide details/);
      expect(templateContent).not.toMatch(/Cancel/);
      expect(templateContent).not.toMatch(/Block this user/);
      expect(templateContent).not.toMatch(/Submitting\.\.\./);
    });
  });

  describe('ReportButtonComponent', () => {
    let templateContent: string;

    beforeAll(() => {
      const content = readFileSync(
        resolve(__dirname, 'report-button.component.ts'),
        'utf-8',
      );
      const match = content.match(/template:\s*`([\s\S]*?)`\s*,/);
      templateContent = match ? match[1] : content;
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

    it('should use i18n translate pipe for the button label', () => {
      expect(templateContent).toContain("'report.button_label'");
    });

    it('should not hardcode English text in the template', () => {
      expect(templateContent).not.toMatch(/>Report</);
      expect(templateContent).not.toMatch(/Flag/);
=======
      expect(templateContent).not.toMatch(/Report user/i);
      expect(templateContent).not.toMatch(/Submit report/i);
      expect(templateContent).not.toMatch(/Cancel/);
      expect(templateContent).not.toMatch(/Block this user/i);
      expect(templateContent).not.toMatch(/Select a reason/i);
      expect(templateContent).not.toMatch(/Additional details/i);
>>>>>>> origin/main
    });
  });
});