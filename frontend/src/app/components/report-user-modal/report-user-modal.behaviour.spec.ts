import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { SafetyService, type ReportCategory } from '../../services/safety.service';
import { toastsSignal } from '../../services/toast.service';
import { ReportUserModalComponent, reportFailureMessageKey } from './report-user-modal.component';

const TARGET_ID = '22222222-2222-4222-8222-222222222222';

const CATEGORIES: ReportCategory[] = [
  { value: 'harassment', label: 'Harassment', description: 'Abusive behaviour' },
  { value: 'spam', label: 'Spam' },
];

describe('ReportUserModalComponent behaviour', () => {
  let fixture: ComponentFixture<ReportUserModalComponent>;
  let component: ReportUserModalComponent;
  let translations: Record<string, string>;
  let safety: {
    getReportCategories: ReturnType<typeof vi.fn>;
    reportUserAsync: ReturnType<typeof vi.fn>;
    blockUserAsync: ReturnType<typeof vi.fn>;
  };

  const toastMessages = (): string[] =>
    toastsSignal().map((toast) => `${toast.type}:${toast.message}`);

  /** Opens the dialog for the default target and waits for the catalogue to load. */
  async function openDialog(
    targetType: 'user' | 'business' = 'user',
    contextUrl?: string,
  ): Promise<void> {
    component.open(TARGET_ID, contextUrl, targetType);
    await vi.waitFor(() => expect(component.loadingCategories()).toBe(false));
  }

  function choose(category: 'harassment' | 'spam' | 'other', details = ''): void {
    component.reportForm.category().value.set(category);
    component.reportForm.description().value.set(details);
  }

  beforeEach(async () => {
    translations = {};
    toastsSignal.set([]);
    safety = {
      getReportCategories: vi.fn().mockResolvedValue(CATEGORIES),
      reportUserAsync: vi.fn().mockResolvedValue({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: false,
      }),
      blockUserAsync: vi.fn().mockResolvedValue({
        success: true,
        blocked_id: TARGET_ID,
        already_blocked: false,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ReportUserModalComponent],
      providers: [
        { provide: SafetyService, useValue: safety },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => translations[key] ?? key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportUserModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('opening', () => {
    it('uses personal wording by default', async () => {
      await openDialog();

      expect(component.isOpen()).toBe(true);
      expect(component.title()).toBe('report.title.user');
      expect(component.intro()).toBe('report.intro.user');
    });

    it('uses business wording when the reported account is a business', async () => {
      await openDialog('business');

      expect(component.title()).toBe('report.title.business');
      expect(component.intro()).toBe('report.intro.business');
    });

    it('loads the reason catalogue from the API', async () => {
      await openDialog();

      expect(safety.getReportCategories).toHaveBeenCalledTimes(1);
      expect(component.categories()).toEqual(CATEGORIES);
      expect(component.loadError()).toBe(false);
    });

    it('offers a retry when the catalogue cannot be loaded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      safety.getReportCategories.mockRejectedValueOnce(new Error('offline'));

      await openDialog();
      expect(component.loadError()).toBe(true);
      expect(component.categories()).toEqual([]);

      component.loadCategories();
      await vi.waitFor(() => expect(component.categories()).toEqual(CATEGORIES));
      expect(component.loadError()).toBe(false);
      expect(component.loadingCategories()).toBe(false);
    });

    it('clears the previous reporter input every time it opens', async () => {
      await openDialog();
      choose('spam', 'Old details');
      component.reportForm.blockUser().value.set(true);

      await openDialog();

      expect(component.reportForm.category().value()).toBe('');
      expect(component.reportForm.description().value()).toBe('');
      expect(component.reportForm.blockUser().value()).toBe(false);
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('closing', () => {
    it('emits modalClosed when cancelled', async () => {
      const closed = vi.fn();
      component.modalClosed.subscribe(closed);
      await openDialog();

      component.cancel();

      expect(component.isOpen()).toBe(false);
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('emits modalClosed once when the dialog closes itself, and not again when already closed', async () => {
      const closed = vi.fn();
      component.modalClosed.subscribe(closed);
      await openDialog();

      component.onDialogStateChanged('closed');
      component.onDialogStateChanged('closed');

      expect(component.isOpen()).toBe(false);
      expect(closed).toHaveBeenCalledTimes(1);
    });
  });

  describe('category copy', () => {
    it('prefers the translation dictionary over the API copy', () => {
      translations['report.category.spam.label'] = 'Spam (translated)';
      translations['report.category.spam.description'] = 'Described (translated)';

      expect(component.categoryLabel({ value: 'spam', label: 'Spam' })).toBe('Spam (translated)');
      expect(component.categoryDescription({ value: 'spam', label: 'Spam' })).toBe(
        'Described (translated)',
      );
    });

    it('falls back to the API copy when no translation exists', () => {
      const category: ReportCategory = {
        value: 'harassment',
        label: 'Harassment',
        description: 'Abusive behaviour',
      };

      expect(component.categoryLabel(category)).toBe('Harassment');
      expect(component.categoryDescription(category)).toBe('Abusive behaviour');
      expect(component.categoryDescription({ value: 'spam', label: 'Spam' })).toBe('');
    });
  });

  describe('submitting', () => {
    it('does not send anything until a reason is chosen', async () => {
      await openDialog();

      expect(component.canSubmit()).toBe(false);
      await component.submitReport();

      expect(safety.reportUserAsync).not.toHaveBeenCalled();
      expect(component.isOpen()).toBe(true);
    });

    it('sends the chosen reason, details and context, then confirms and closes', async () => {
      const reported = vi.fn();
      const closed = vi.fn();
      component.reported.subscribe(reported);
      component.modalClosed.subscribe(closed);
      await openDialog('user', '/chat/room-1');
      choose('harassment', 'Sent abusive messages');

      await component.submitReport();

      expect(safety.reportUserAsync).toHaveBeenCalledTimes(1);
      expect(safety.reportUserAsync).toHaveBeenCalledWith({
        reported_id: TARGET_ID,
        reason_category: 'harassment',
        description: 'Sent abusive messages',
        context_url: '/chat/room-1',
      });
      expect(safety.blockUserAsync).not.toHaveBeenCalled();
      expect(reported).toHaveBeenCalledTimes(1);
      expect(closed).toHaveBeenCalledTimes(1);
      expect(component.isOpen()).toBe(false);
      expect(component.isSubmitting()).toBe(false);
      expect(toastMessages()).toEqual(['success:report.toast_success']);
    });

    it('omits blank details instead of sending an empty description', async () => {
      await openDialog();
      choose('spam');

      await component.submitReport();

      expect(safety.reportUserAsync).toHaveBeenCalledWith({
        reported_id: TARGET_ID,
        reason_category: 'spam',
        description: undefined,
        context_url: undefined,
      });
    });

    it('tells the reporter when an open report already exists', async () => {
      safety.reportUserAsync.mockResolvedValueOnce({
        success: true,
        message: 'Report submitted successfully',
        report_id: 'report-1',
        duplicate: true,
      });
      await openDialog();
      choose('spam');

      await component.submitReport();

      expect(toastMessages()).toEqual(['success:report.toast_duplicate']);
      expect(component.isOpen()).toBe(false);
    });

    it('also blocks the account when requested and confirms it', async () => {
      await openDialog();
      choose('harassment');
      component.reportForm.blockUser().value.set(true);

      await component.submitReport();

      expect(safety.blockUserAsync).toHaveBeenCalledWith(TARGET_ID);
      expect(toastMessages()).toEqual([
        'success:report.toast_success',
        'success:report.block_success',
      ]);
      expect(component.isOpen()).toBe(false);
    });

    it('keeps the filed report and says so when the follow-up block fails', async () => {
      safety.blockUserAsync.mockRejectedValueOnce(new Error('service unavailable'));
      await openDialog();
      choose('harassment');
      component.reportForm.blockUser().value.set(true);

      await component.submitReport();

      expect(toastMessages()).toEqual([
        'success:report.toast_success',
        'error:report.block_failed',
      ]);
      expect(component.isOpen()).toBe(false);
      expect(component.errorMessage()).toBeNull();
    });

    it('stays open with a retryable message and never blocks when the report fails', async () => {
      safety.reportUserAsync.mockRejectedValueOnce(new Error('service unavailable'));
      await openDialog();
      choose('harassment');
      component.reportForm.blockUser().value.set(true);

      await component.submitReport();

      expect(component.isOpen()).toBe(true);
      expect(component.isSubmitting()).toBe(false);
      expect(component.errorMessage()).toBe('report.toast_error');
      expect(safety.blockUserAsync).not.toHaveBeenCalled();
      expect(toastMessages()).toEqual([]);

      await component.submitReport();
      expect(safety.reportUserAsync).toHaveBeenCalledTimes(2);
      expect(component.isOpen()).toBe(false);
    });

    it('shows the daily limit message when the API answers 429', async () => {
      safety.reportUserAsync.mockRejectedValueOnce(
        new HttpErrorResponse({ status: 429, url: 'https://api.example.test/safety/report' }),
      );
      await openDialog();
      choose('spam');

      await component.submitReport();

      expect(component.errorMessage()).toBe('report.rate_limited');
      expect(component.isOpen()).toBe(true);
    });

    it('never shows transport details such as the request URL', async () => {
      const failure = new HttpErrorResponse({
        status: 500,
        url: 'https://api.example.test/safety/report',
      });
      safety.reportUserAsync.mockRejectedValueOnce(failure);
      await openDialog();
      choose('spam');

      await component.submitReport();

      expect(failure.message).toContain('api.example.test');
      expect(component.errorMessage()).toBe('report.toast_error');
    });

    it('ignores a second submission while one is in flight', async () => {
      let finish: (value: unknown) => void = () => undefined;
      safety.reportUserAsync.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      await openDialog();
      choose('spam');

      const first = component.submitReport();
      expect(component.isSubmitting()).toBe(true);
      expect(component.canSubmit()).toBe(false);
      await component.submitReport();
      expect(safety.reportUserAsync).toHaveBeenCalledTimes(1);

      finish({ success: true, message: 'ok', report_id: 'report-1', duplicate: false });
      await first;
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('reportFailureMessageKey', () => {
    it('maps rate limiting, missing accounts and everything else to translated copy', () => {
      expect(reportFailureMessageKey(new HttpErrorResponse({ status: 429 }))).toBe(
        'report.rate_limited',
      );
      expect(reportFailureMessageKey(new HttpErrorResponse({ status: 404 }))).toBe(
        'report.target_not_found',
      );
      expect(reportFailureMessageKey(new HttpErrorResponse({ status: 400 }))).toBe(
        'report.toast_error',
      );
      expect(reportFailureMessageKey(new HttpErrorResponse({ status: 0 }))).toBe(
        'report.toast_error',
      );
      expect(reportFailureMessageKey(new Error('boom'))).toBe('report.toast_error');
      expect(reportFailureMessageKey('boom')).toBe('report.toast_error');
    });
  });
});
