import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GdprComponent } from './gdpr.component';
import { GdprService, PrivacyStatus } from '../../services/gdpr.service';
import { I18nService } from '../../services/i18n.service';

const EMPTY_STATUS: PrivacyStatus = {
  is_deletion_pending: false,
  scheduled_for_deletion_at: null,
  latest_archive: null,
};

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
      getStatus: vi.fn().mockResolvedValue(EMPTY_STATUS),
      requestArchive: vi.fn().mockResolvedValue(undefined),
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

  it('should render the GDPR title and description', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.app-header-title')?.textContent).toContain('gdpr.title');
    expect(el.textContent).toContain('gdpr.archiveSection');
    expect(el.textContent).toContain('gdpr.deleteSection');
  });

  it('should call requestArchive and show success', async () => {
    fixture.componentInstance.requestArchive();
    expect(mockGdprService.requestArchive).toHaveBeenCalled();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('gdpr.archiveSuccess');
  });

  it('should expose the signed archive download returned by status', async () => {
    mockGdprService.getStatus.mockResolvedValue({
      is_deletion_pending: false,
      scheduled_for_deletion_at: null,
      latest_archive: {
        requested_at: '2026-08-20T12:00:00.000Z',
        download_url: 'https://storage.example.test/signed-archive',
        expires_in_seconds: 900,
      },
    });

    await fixture.componentInstance.requestArchive();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a[href="https://storage.example.test/signed-archive"]',
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should restore pending deletion state from the API', async () => {
    mockGdprService.getStatus.mockResolvedValue({
      is_deletion_pending: true,
      scheduled_for_deletion_at: '2026-09-19T12:00:00.000Z',
      latest_archive: null,
    });

    const restoredFixture = TestBed.createComponent(GdprComponent);
    restoredFixture.detectChanges();
    await restoredFixture.whenStable();
    restoredFixture.detectChanges();

    expect(restoredFixture.componentInstance.isPendingDeletion()).toBe(true);
    expect(restoredFixture.nativeElement.textContent).toContain('gdpr.cancelDeletionSection');
  });

  it('should call deleteAccount when confirmed', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    fixture.detectChanges();

    fixture.componentInstance.deleteAccount();
    expect(mockGdprService.deleteAccount).toHaveBeenCalledWith(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isPendingDeletion()).toBe(true);
  });

  it('should not call deleteAccount when not confirmed', () => {
    fixture.componentInstance.confirmDelete.set(false);
    fixture.componentInstance.deleteAccount();
    expect(mockGdprService.deleteAccount).not.toHaveBeenCalled();
  });

  it('should show cancel deletion section after a deletion request', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    await fixture.componentInstance.deleteAccount();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('gdpr.cancelDeletionSection');
  });

  it('should call cancelDeletion and hide section on success', async () => {
    fixture.componentInstance.confirmDelete.set(true);
    await fixture.componentInstance.deleteAccount();
    fixture.detectChanges();

    fixture.componentInstance.cancelDeletion();
    expect(mockGdprService.cancelDeletion).toHaveBeenCalled();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.isPendingDeletion()).toBe(false);
  });

  it('should show archive error when requestArchive fails', async () => {
    mockGdprService.requestArchive.mockRejectedValue(new Error('Network error'));
    fixture.componentInstance.requestArchive();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.archiveError()).toBe('common.loadError');
  });
});
