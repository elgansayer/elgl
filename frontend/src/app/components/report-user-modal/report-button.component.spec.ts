import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('ReportButtonComponent', () => {
  describe('RTL logical CSS compliance', () => {
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

    it('should use direction-agnostic flexbox for layout', () => {
      expect(templateContent).toContain('inline-flex');
      expect(templateContent).toContain('items-center');
    });

    it('should use i18n translate pipe for user-facing text', () => {
      expect(templateContent).toContain("'report.button_label' | t");
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toMatch(/>\s*Report\s*</);
      expect(templateContent).not.toMatch(/Report User/);
      expect(templateContent).not.toMatch(/Flag/);
    });
  });
});