import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const reportDir = resolve(__dirname, '..', 'report-user-modal');

/**
 * Trust & Safety Architecture RTL Logical CSS Verification
 *
 * Covers all Trust & Safety UI components:
 *  - trust-safety-modal (block + report inline)
 *  - report-user-modal (standalone report flow)
 *  - report-button (report trigger)
 *
 * Ensures production readiness by verifying:
 *  1. Zero physical direction CSS utilities (pl-/pr-/ml-/mr-/left-/right-/border-l/border-r)
 *  2. Logical inline-start/end spacing (ps-, pe-, ms-, me-) where appropriate
 *  3. Block-axis border/spacing stays block-axis (border-t/border-b/pb/pt)
 *  4. All user-facing strings use TranslatePipe
 *  5. Interaction-heavy controls delegate semantics to owned Spartan primitives
 */

interface ComponentInfo {
  name: string;
  filePath: string;
  isInlineTemplate: boolean;
}

const TRUST_SAFETY_COMPONENTS: ComponentInfo[] = [
  {
    name: 'TrustSafetyModal',
    filePath: resolve(__dirname, 'trust-safety-modal.component.ts'),
    isInlineTemplate: true,
  },
  {
    name: 'ReportUserModal',
    filePath: resolve(reportDir, 'report-user-modal.component.html'),
    isInlineTemplate: false,
  },
  {
    name: 'ReportButton',
    filePath: resolve(reportDir, 'report-button.component.ts'),
    isInlineTemplate: true,
  },
];

function extractTemplate(component: ComponentInfo): string {
  const content = readFileSync(component.filePath, 'utf-8');
  if (component.isInlineTemplate) {
    const match = content.match(/template:\s*`([\s\S]*?)`\s*,/);
    return match ? match[1] : content;
  }
  return content;
}

/** Physical direction patterns that must never appear in Trust & Safety UI. */
const PHYSICAL_DIRECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bpl-\d/, // padding-left
  /\bpr-\d/, // padding-right
  /\bml-\d/, // margin-left
  /\bmr-\d/, // margin-right
  /\bleft-[0-9]/, // left-N
  /\bright-[0-9]/, // right-N
  /\bborder-l\b/, // border-left
  /\bborder-r\b/, // border-right
  /\btext-left\b/,
  /\btext-right\b/,
];

describe('Trust & Safety Architecture - RTL Logical CSS Verification', () => {
  const templates = new Map<string, string>();

  beforeAll(() => {
    for (const component of TRUST_SAFETY_COMPONENTS) {
      templates.set(component.name, extractTemplate(component));
    }
  });

  describe('Physical direction ban (all components)', () => {
    for (const component of TRUST_SAFETY_COMPONENTS) {
      describe(component.name, () => {
        let template: string;

        beforeAll(() => {
          template = templates.get(component.name)!;
        });

        it('should contain template content', () => {
          expect(template.length).toBeGreaterThan(0);
        });

        for (const pattern of PHYSICAL_DIRECTION_PATTERNS) {
          it(`should not contain physical direction pattern: ${pattern.source}`, () => {
            expect(template).not.toMatch(pattern);
          });
        }
      });
    }
  });

  describe('Logical CSS property coverage', () => {
    describe('TrustSafetyModal', () => {
      let template: string;

      beforeAll(() => {
        template = templates.get('TrustSafetyModal')!;
      });

      it('should use ps-1 for inline-start padding on labels', () => {
        expect(template).toContain('ps-1');
      });

      it('should use px- (inline-start+end) for horizontal padding on inputs', () => {
        expect(template).toContain('px-');
      });

      it('should use block-axis borders only (border-b, border-t)', () => {
        expect(template).toContain('border-b');
        expect(template).toContain('border-t');
      });

      it('should use pb- / pt- for block-axis padding only', () => {
        expect(template).toContain('pb-');
        expect(template).toContain('pt-');
      });

      it('should use flex layout with logical positioning', () => {
        expect(template).toContain('flex');
        expect(template).toContain('justify-between');
        expect(template).toContain('justify-end');
        expect(template).toContain('items-center');
      });
    });

    describe('ReportUserModal', () => {
      let template: string;

      beforeAll(() => {
        template = templates.get('ReportUserModal')!;
      });

      it('should use ps-1 for inline-start padding on labels and legends', () => {
        expect(template).toContain('ps-1');
      });

      it('should use me- for inline-end margin on icon spacing', () => {
        expect(template).toContain('me-');
      });

      it('should use ms- for inline-start margin on radio indicator', () => {
        expect(template).toContain('ms-');
      });

      it('should use -me-2 for negative inline-end margin on close button', () => {
        expect(template).toContain('-me-2');
      });

      it('should delegate the block-user toggle to the owned Spartan checkbox', () => {
        expect(template).toContain('<hlm-checkbox');
        expect(template).toContain('[formField]="reportForm.blockUser"');
        expect(template).not.toContain('rtl:peer-checked:after:-translate-x-full');
        expect(template).not.toContain('after:start-[2px]');
      });
    });

    describe('ReportButton', () => {
      let template: string;

      beforeAll(() => {
        template = templates.get('ReportButton')!;
      });

      it('should use inline-flex and items-center for logical layout', () => {
        expect(template).toContain('inline-flex');
        expect(template).toContain('items-center');
      });

      it('should use px- and py- for logical padding', () => {
        expect(template).toContain('px-');
        expect(template).toContain('py-');
      });
    });
  });

  describe('i18n coverage (all user-facing strings use TranslatePipe)', () => {
    describe('TrustSafetyModal', () => {
      let template: string;
      beforeAll(() => {
        template = templates.get('TrustSafetyModal')!;
      });

      it('should use TranslatePipe for all safety.* keys', () => {
        const requiredKeys = [
          'safety.title',
          'safety.subtitle',
          'safety.closeBtn',
          'safety.tabReport',
          'safety.tabBlock',
          'safety.reasonLabel',
          'safety.detailsLabel',
          'safety.detailsPlaceholder',
          'safety.blockWarning',
          'safety.blockList1',
          'safety.blockList2',
          'safety.blockList3',
          'safety.cancelBtn',
          'safety.submitReportBtn',
          'safety.confirmBlockBtn',
        ];
        for (const key of requiredKeys) {
          expect(template).toContain(`'${key}'`);
        }
      });
    });

    describe('ReportUserModal', () => {
      let template: string;
      beforeAll(() => {
        template = templates.get('ReportUserModal')!;
      });

      it('should use TranslatePipe for all report.* keys', () => {
        const requiredKeys = [
          'report.title',
          'report.close',
          'report.reason_label',
          'report.details_label',
          'report.details_placeholder',
          'report.block_user',
          'report.cancel',
          'report.submit',
          'report.submitting',
          'report.load_error',
          'report.retry',
        ];
        for (const key of requiredKeys) {
          expect(template).toContain(`'${key}'`);
        }
      });
    });

    describe('ReportButton', () => {
      let template: string;
      beforeAll(() => {
        template = templates.get('ReportButton')!;
      });

      it('should use TranslatePipe for report.button_label', () => {
        expect(template).toContain("'report.button_label' | t");
      });
    });
  });

  /**
   * Aggregate verification: the entire Trust & Safety architecture must not
   * contain any hardcoded English strings that should be translated.
   */
  describe('Hardcoded English string ban (aggregate)', () => {
    it('should not hardcode Trust & Safety UI strings in any component', () => {
      const bannedStrings = [
        'Submit report',
        'Confirm block',
        'Report or block',
        'Trust and safety moderation',
        'Report user',
        'Block this user',
        'Select violation category',
        'Additional context',
        'Cancel',
        'Select a reason',
        'Additional details',
        'Flag',
        'Harassment / Bullying',
        'Spam / Commercial Advertising',
        'Inappropriate / Offensive Language',
        'Suspicious Link / Scam',
        'Other Violation',
        'What happens when you block',
      ];

      for (const component of TRUST_SAFETY_COMPONENTS) {
        const template = templates.get(component.name)!;
        for (const banned of bannedStrings) {
          expect(template).not.toMatch(new RegExp(banned.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
        }
      }
    });
  });

  /**
   * Production readiness check: verify that all Logical CSS properties
   * used in the Trust & Safety architecture are recognised RTL-safe utilities.
   */
  describe('Production readiness - pe- (padding-inline-end) audit', () => {
    it('should use either pe- or px- (not pr-) for inline-end padding across all components', () => {
      for (const component of TRUST_SAFETY_COMPONENTS) {
        const template = templates.get(component.name)!;
        expect(template).not.toMatch(/\bpr-\d/);
      }
    });

    it('should use either ps- or px- (not pl-) for inline-start padding across all components', () => {
      for (const component of TRUST_SAFETY_COMPONENTS) {
        const template = templates.get(component.name)!;
        expect(template).not.toMatch(/\bpl-\d/);
      }
    });

    it('should use either ms- or mx- (not ml-) for inline-start margin across all components', () => {
      for (const component of TRUST_SAFETY_COMPONENTS) {
        const template = templates.get(component.name)!;
        expect(template).not.toMatch(/\bml-\d/);
      }
    });

    it('should use either me- or mx- (not mr-) for inline-end margin across all components', () => {
      for (const component of TRUST_SAFETY_COMPONENTS) {
        const template = templates.get(component.name)!;
        expect(template).not.toMatch(/\bmr-\d/);
      }
    });
  });
});
