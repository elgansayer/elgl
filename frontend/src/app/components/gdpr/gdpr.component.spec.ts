import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GdprComponent } from './gdpr.component';
import { GdprService } from '../../services/gdpr.service';
import { I18nService } from '../../services/i18n.service';

describe('GdprComponent', () => {
  let fixture: ComponentFixture<GdprComponent>;
  let mockGdprService: {
    getStatus: ReturnType<typeof vi.fn>;
    requestArchive: ReturnType<typeof vi.fn>;
    deleteAccount: ReturnType<typeof vi.fn>;
    cancelDeletion: ReturnType<typeof vi.fn>;
  };
  let mockI18nService: {
    translate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockGdprService = {
      getStatus: vi.fn().mockResolvedValue({
        is_deletion_pending: false,
        scheduled_for_deletion_at: null,
        latest_archive: null,
      }),
      requestArchive: vi.fn().mockResolvedValue({
        request_id: '11111111-1111-4111-8111-111111111111',
        status: 'ready',
        download_url:
          'https://example.supabase.co/storage/v1/object/sign/gdpr-archives/archive.json?token=short-lived',
        expires_at: '2026-09-01T00:00:00.000Z',
        message: 'Archive ready for download.',
      }),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
      cancelDeletion: vi.fn().mockResolvedValue(undefined),
    };

    mockI18nService = {
      translate: vi.fn((key: string, _params?: Record<string, unknown>) => key),
    };

    await TestBed.configureTestingModule({
      imports: [GdprComponent],
      providers: [
        { provide: GdprService, useValue: mockGdprService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GdprComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the GDPR title and description', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.app-header-title')?.textContent).toContain('gdpr.title');
    expect(el.textContent).toContain('gdpr.archiveSection');
    expect(el.textContent).toContain('gdpr.deleteSection');
  });

  it('requests a private archive, downloads the signed URL, and shows success', async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await fixture.componentInstance.requestArchive();
    fixture.detectChanges();

    expect(mockGdprService.requestArchive).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('gdpr.archiveSuccess');
  });

  it('accepts an idempotent in-progress response without inventing a download', async () => {
    mockGdprService.requestArchive.mockResolvedValue({
      request_id: '22222222-2222-4222-8222-222222222222',
      status: 'processing',
      message: 'Archive preparation is already in progress.',
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    await fixture.componentInstance.requestArchive();

    expect(clickSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.archiveSuccess()).toBe(true);
  });

  it('rejects non-http signed URL schemes', async () => {
    mockGdprService.requestArchive.mockResolvedValue({
      request_id: '33333333-3333-4333-8333-333333333333',
      status: 'ready',
      download_url: 'javascript:alert(1)',
      message: 'Archive ready for download.',
    });

    await fixture.componentInstance.requestArchive();

    expect(fixture.componentInstance.archiveSuccess()).toBe(false);
    expect(fixture.componentInstance.archiveError()).toBe('common.loadError');
  });

  it('deduplicates concurrent archive requests', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    mockGdprService.requestArchive.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = fixture.componentInstance.requestArchive();
    const second = fixture.componentInstance.requestArchive();
    expect(mockGdprService.requestArchive).toHaveBeenCalledTimes(1);

    resolveRequest?.({
      request_id: '44444444-4444-4444-8444-444444444444',
      status: 'processing',
      message: 'Archive preparation is already in progress.',
    });
    await Promise.all([first, second]);
  });

  it('should call deleteAccount when confirmed', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    fixture.detectChanges();

    await fixture.componentInstance.deleteAccount();

    expect(mockGdprService.deleteAccount).toHaveBeenCalledWith(true);
    expect(fixture.componentInstance.isPendingDeletion()).toBe(true);
  });

  it('deduplicates concurrent delete submissions', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    let resolveDelete: (() => void) | undefined;
    mockGdprService.deleteAccount.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    const first = fixture.componentInstance.deleteAccount();
    const second = fixture.componentInstance.deleteAccount();
    expect(mockGdprService.deleteAccount).toHaveBeenCalledTimes(1);

    resolveDelete?.();
    await Promise.all([first, second]);
  });

  it('should not call deleteAccount when not confirmed', () => {
    fixture.componentInstance.confirmDelete.set(false);
    void fixture.componentInstance.deleteAccount();
    expect(mockGdprService.deleteAccount).not.toHaveBeenCalled();
  });

  it('should show cancel deletion section when deletion is pending', () => {
    mockGdprService.getStatus.mockResolvedValue({
      is_deletion_pending: true,
      scheduled_for_deletion_at: '2026-09-29T00:00:00.000Z',
      latest_archive: null,
    });
    fixture.componentInstance.privacyStatusResource.reload();
    fixture.detectChanges();

    return fixture.whenStable().then(() => {
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('gdpr.cancelDeletionSection');
    });
  });

  it('restores and downloads the latest ready archive after reload', async () => {
    mockGdprService.getStatus.mockResolvedValue({
      is_deletion_pending: false,
      scheduled_for_deletion_at: null,
      latest_archive: {
        request_id: '55555555-5555-4555-8555-555555555555',
        status: 'ready',
        download_url: 'https://storage.example/signed/archive?token=restored',
        expires_at: '2026-09-01T00:00:00.000Z',
      },
    });
    fixture.componentInstance.privacyStatusResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    fixture.componentInstance.downloadLatestArchive();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('privacy.hub.downloadData');
  });

  it('should call cancelDeletion and hide section on success', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    await fixture.componentInstance.deleteAccount();
    fixture.detectChanges();

    await fixture.componentInstance.cancelDeletion();

    expect(mockGdprService.cancelDeletion).toHaveBeenCalled();
    expect(fixture.componentInstance.isPendingDeletion()).toBe(false);
  });

  it('should show archive error when requestArchive fails', async () => {
    mockGdprService.requestArchive.mockRejectedValue(new Error('Network error'));

    await fixture.componentInstance.requestArchive();

    expect(fixture.componentInstance.archiveError()).toBe('common.loadError');
  });

  it('shows an error when persisted privacy status cannot be restored', async () => {
    mockGdprService.getStatus.mockRejectedValue(new Error('Network error'));
    fixture.componentInstance.privacyStatusResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.statusLoadError()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'common.loadError',
    );
  });
});
