import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AdminErrorBoundaryComponent } from './admin-error-boundary.component';
import { CrashReportService } from '../../services/crash-report.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { I18nService } from '../../services/i18n.service';

describe('AdminErrorBoundaryComponent', () => {
  let component: AdminErrorBoundaryComponent;
  let fixture: ComponentFixture<AdminErrorBoundaryComponent>;
  let reportCrashSpy: ReturnType<typeof vi.fn>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let pendingCrashCountSignal: ReturnType<typeof signal<number>>;

  beforeEach(async () => {
    reportCrashSpy = vi.fn().mockResolvedValue(undefined);
    onlineSignal = signal(true);
    pendingCrashCountSignal = signal(0);

    await TestBed.configureTestingModule({
      imports: [AdminErrorBoundaryComponent],
      providers: [
        provideRouter([]),
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: reportCrashSpy,
            pendingCrashCount: pendingCrashCountSignal.asReadonly(),
            lastCrash: signal(null).asReadonly(),
          },
        },
        {
          provide: OfflineAdminStorageService,
          useValue: {
            isOnline: onlineSignal.asReadonly(),
          },
        },
        { provide: I18nService, useValue: { translate: vi.fn((k: string, p?: Record<string, string | number>) => {
          if (p && Object.keys(p).length > 0) return `${k} ${JSON.stringify(p)}`;
          return k;
        }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminErrorBoundaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show error UI when handleError is called', () => {
    component.handleError(new Error('Test crash'));
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('admin.errorBoundary.title');
    expect(alert.textContent).toContain('Test crash');
  });

  it('should call crash report service when handling error', () => {
    const error = new Error('Admin panel crashed');
    component.handleError(error);

    expect(reportCrashSpy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        route: expect.any(String) as string,
        component: expect.stringContaining('Admin') as string,
        adminRole: 'admin',
        offline: expect.any(Boolean) as boolean,
      }),
    );
  });

  it('should show offline status in crash context', () => {
    onlineSignal.set(false);
    const error = new Error('Offline render crash');
    component.handleError(error);
    fixture.detectChanges();

    expect(reportCrashSpy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        offline: true,
      }),
    );
  });

  it('should show action buttons', () => {
    component.handleError(new Error('Oops'));
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    const buttonTexts = Array.from(buttons).map((b) => (b as HTMLElement).textContent?.trim());
    expect(buttonTexts).toContain('admin.errorBoundary.retry');
    expect(buttonTexts).toContain('admin.errorBoundary.goHome');
    expect(buttonTexts).toContain('admin.errorBoundary.showDetails');
  });

  it('should toggle detail visibility', () => {
    component.handleError(new Error('Secret details'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('admin.errorBoundary.showDetails');

    const toggleBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.includes('admin.errorBoundary.showDetails'),
    ) as HTMLElement;
    toggleBtn?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('admin.errorBoundary.hideDetails');
    expect(fixture.nativeElement.querySelector('.overflow-y-auto')).toBeTruthy();
  });

  it('should clear error state on retry', () => {
    component.handleError(new Error('Temp error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const retryBtn = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLElement).textContent?.includes('admin.errorBoundary.retry'),
    ) as HTMLElement;
    retryBtn?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('should show pending crash count when > 0', () => {
    pendingCrashCountSignal.set(3);
    component.handleError(new Error('Crashed'));
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('"count":3');
    expect(alert.textContent).toContain('admin.errorBoundary.pendingReports');
  });

  it('should handle Error without stack gracefully', () => {
    const error = new Error('Stackless');
    Object.defineProperty(error, 'stack', { value: undefined });
    component.handleError(error);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});