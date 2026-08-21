import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

describe('TrustSafetyModalComponent', () => {
  describe('RTL logical CSS compliance', () => {
    let templateContent: string;

    beforeAll(() => {
      const content = readFileSync(
        resolve(__dirname, 'trust-safety-modal.component.ts'),
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
      ];
      for (const pattern of violations) {
        expect(templateContent).not.toMatch(pattern);
      }
    });

    it('should use logical CSS utilities for inline start padding', () => {
      expect(templateContent).toContain('ps-1');
    });

    it('should use block axis border utilities (RTL safe)', () => {
      expect(templateContent).toContain('border-b');
      expect(templateContent).toContain('border-t');
    });

    it('should use logical flex layout properties', () => {
      expect(templateContent).toContain('flex');
      expect(templateContent).toContain('justify-between');
      expect(templateContent).toContain('justify-end');
    });

    it('should use i18n translate pipe for user-facing strings', () => {
      const keys = [
        'safety.title', 'safety.subtitle', 'safety.closeBtn',
        'safety.tabReport', 'safety.tabBlock',
        'safety.reasonLabel', 'safety.detailsLabel', 'safety.detailsPlaceholder',
        'safety.blockWarning', 'safety.blockList1', 'safety.blockList2', 'safety.blockList3',
        'safety.cancelBtn', 'safety.submitReportBtn', 'safety.confirmBlockBtn',
      ];
      for (const key of keys) {
        expect(templateContent).toContain("'" + key + "'");
      }
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toMatch(/Submit report/);
      expect(templateContent).not.toMatch(/Confirm block/);
      expect(templateContent).not.toMatch(/Report or block/);
      expect(templateContent).not.toMatch(/Trust and safety moderation/);
      expect(templateContent).not.toMatch(/Harassment \/ Bullying/);
      expect(templateContent).not.toMatch(/Spam \/ Commercial Advertising/);
      expect(templateContent).not.toMatch(/Inappropriate \/ Offensive Language/);
      expect(templateContent).not.toMatch(/Suspicious Link \/ Scam/);
      expect(templateContent).not.toMatch(/Other Violation/);
      expect(templateContent).not.toMatch(/What happens when you block/);
      expect(templateContent).not.toMatch(/Select violation category/);
      expect(templateContent).not.toMatch(/Additional context/);
    });
  });

  describe('ARIA accessibility compliance', () => {
    let templateContent: string;

    beforeAll(() => {
      const content = readFileSync(
        resolve(__dirname, 'trust-safety-modal.component.ts'),
        'utf-8',
      );
      const match = content.match(/template:\s*`([\s\S]*?)`\s*,/);
      templateContent = match ? match[1] : content;
    });

    it('should delegate dialog role, modality, focus management and Escape handling to Spartan Dialog', () => {
      expect(templateContent).toContain('<hlm-dialog');
      expect(templateContent).toContain('<hlm-dialog-content');
      expect(templateContent).toContain('*hlmDialogPortal');
      expect(templateContent).toContain('[state]="dialogState()"');
      expect(templateContent).not.toContain('(keydown)="onKeydown($event)"');
    });

    it('should have aria-labelledby and aria-describedby for screen reader context', () => {
      expect(templateContent).toContain('aria-labelledby="trust-safety-title"');
      expect(templateContent).toContain('aria-describedby="trust-safety-description"');
      expect(templateContent).toContain('id="trust-safety-title"');
      expect(templateContent).toContain('id="trust-safety-description"');
    });

    it('should have tablist role with aria-label for the tab container', () => {
      expect(templateContent).toContain('role="tablist"');
      expect(templateContent).toContain("'safety.tabListLabel'");
    });

    it('should have proper tab roles with aria-selected, aria-controls, and tabindex', () => {
      expect(templateContent).toContain('id="trust-safety-tab-report"');
      expect(templateContent).toMatch(/role="tab"[^>]*aria-selected/);
      expect(templateContent).toMatch(/aria-controls\]="'trust-safety-panel-report'"/);
      expect(templateContent).toContain('id="trust-safety-tab-block"');
      expect(templateContent).toMatch(/aria-controls\]="'trust-safety-panel-block'"/);
    });

    it('should have tabpanel roles with aria-labelledby pointing to tab ids', () => {
      expect(templateContent).toContain('role="tabpanel"');
      expect(templateContent).toContain('aria-labelledby="trust-safety-tab-report"');
      expect(templateContent).toContain('aria-labelledby="trust-safety-tab-block"');
    });

    it('should mark the select element as required with aria-required', () => {
      expect(templateContent).toContain('aria-required="true"');
    });

    it('should use role="alert" for the block warning section', () => {
      expect(templateContent).toContain('role="alert"');
    });

    it('should indicate loading state with aria-busy', () => {
      expect(templateContent).toContain('aria-busy="true"');
      expect(templateContent).toContain("'safety.categoriesLoading'");
    });

    it('should retain keyboard navigation for the custom tablist while dialog keyboard behavior is owned by Spartan', () => {
      expect(templateContent).toContain('(keydown)="onTabKeydown($event,');
      expect(templateContent).not.toContain('(keydown)="onKeydown($event)"');
    });

    it('should have descriptive aria-labels on action buttons', () => {
      expect(templateContent).toContain("'safety.submitReportAria'");
      expect(templateContent).toContain("'safety.confirmBlockAria'");
    });
  });
});
