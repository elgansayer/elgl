import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { ReportButtonComponent } from './report-button.component';
import { ReportUserModalService } from './report-user-modal.service';

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

    it('should resolve the label through the translate pipe', () => {
      expect(templateContent).toContain('labelKey() | t');
    });

    it('should not hardcode English user-facing strings', () => {
      expect(templateContent).not.toMatch(/>\s*Report\s*</);
      expect(templateContent).not.toMatch(/Report User/);
      expect(templateContent).not.toMatch(/Flag/);
    });
  });

  describe('behaviour', () => {
    let open: ReturnType<typeof vi.fn>;
    let fixture: ComponentFixture<ReportButtonComponent>;

    function render(inputs: Record<string, unknown>): void {
      fixture = TestBed.createComponent(ReportButtonComponent);
      for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
      }
      fixture.detectChanges();
    }

    function button(): HTMLButtonElement {
      const element = fixture.nativeElement.querySelector('button');
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error('Report button was not rendered');
      }
      return element;
    }

    beforeEach(async () => {
      open = vi.fn();
      await TestBed.configureTestingModule({
        imports: [ReportButtonComponent],
        providers: [
          { provide: ReportUserModalService, useValue: { open } },
          { provide: I18nService, useValue: { translate: (key: string) => key } },
        ],
      }).compileComponents();
    });

    it('is a real button that shows the default translated label', () => {
      render({ userId: 'user-1' });

      expect(button().getAttribute('type')).toBe('button');
      expect(button().textContent?.trim()).toBe('report.button_label');
    });

    it('opens the report dialog for a personal account by default', () => {
      render({ userId: 'user-1' });

      button().click();

      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith('user-1', undefined, 'user');
    });

    it('forwards the context link and the business target type', () => {
      render({ userId: 'business-1', contextUrl: '/chat/room-1', targetType: 'business' });

      button().click();

      expect(open).toHaveBeenCalledWith('business-1', '/chat/room-1', 'business');
    });

    it('lets a caller supply its own translated label key', () => {
      render({ userId: 'business-1', labelKey: 'report.title.business' });

      expect(button().textContent?.trim()).toBe('report.title.business');
    });
  });
});
