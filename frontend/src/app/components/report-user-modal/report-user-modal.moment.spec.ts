import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { ReportButtonComponent } from './report-button.component';
import { ReportUserModalComponent } from './report-user-modal.component';
import { ReportUserModalService } from './report-user-modal.service';

describe('Reporting a Moment through the shared dialog', () => {
  describe('ReportUserModalComponent', () => {
    let reportUserAsync: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      reportUserAsync = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
      await TestBed.configureTestingModule({
        imports: [ReportUserModalComponent],
        providers: [
          {
            provide: SafetyService,
            useValue: {
              getReportCategories: vi.fn().mockResolvedValue([]),
              reportUserAsync,
              blockUserAsync: vi.fn().mockResolvedValue({ success: true }),
            },
          },
          { provide: I18nService, useValue: { translate: vi.fn((key: string) => key) } },
        ],
      })
        .overrideComponent(ReportUserModalComponent, { set: { template: '', imports: [] } })
        .compileComponents();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('submits the Moment id with the report', async () => {
      const modal = TestBed.createComponent(ReportUserModalComponent).componentInstance;
      modal.open('author-2', undefined, 'moment-9');
      modal.reportForm.category().value.set('harassment');

      await modal.submitReport();

      expect(reportUserAsync).toHaveBeenCalledWith({
        reported_id: 'author-2',
        reason_category: 'harassment',
        description: undefined,
        context_url: undefined,
        moment_id: 'moment-9',
      });
    });

    it('does not carry a previous Moment id into a plain profile report', async () => {
      const modal = TestBed.createComponent(ReportUserModalComponent).componentInstance;
      modal.open('author-2', undefined, 'moment-9');
      modal.open('author-3');
      modal.reportForm.category().value.set('spam');

      await modal.submitReport();

      expect(reportUserAsync.mock.calls[0][0].moment_id).toBeUndefined();
      expect(reportUserAsync.mock.calls[0][0].reported_id).toBe('author-3');
    });
  });

  describe('ReportButtonComponent', () => {
    it('forwards an optional Moment id to the dialog', () => {
      const open = vi.fn();
      TestBed.configureTestingModule({
        providers: [{ provide: ReportUserModalService, useValue: { open } }],
      });
      const fixture = TestBed.createComponent(ReportButtonComponent);
      fixture.componentRef.setInput('userId', 'author-2');
      fixture.componentRef.setInput('momentId', 'moment-9');

      fixture.componentInstance.openReportModal();

      expect(open).toHaveBeenCalledWith('author-2', undefined, 'moment-9');
    });
  });

  describe('ReportUserModalService', () => {
    it('passes the Moment id through to the registered dialog', () => {
      const service = TestBed.inject(ReportUserModalService);
      const open = vi.fn();
      service.registerModal({ open } as unknown as ReportUserModalComponent);

      service.open('author-2', 'https://example.test/context', 'moment-9');

      expect(open).toHaveBeenCalledWith('author-2', 'https://example.test/context', 'moment-9');
    });
  });
});
