import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { AdminOfflineBannerComponent } from './admin-offline-banner.component';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { I18nService } from '../../services/i18n.service';

describe('AdminOfflineBannerComponent', () => {
  let component: AdminOfflineBannerComponent;
  let fixture: ComponentFixture<AdminOfflineBannerComponent>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let cachedSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    onlineSignal = signal(true);
    cachedSignal = signal(false);

    const storageMock = {
      isOnline: onlineSignal.asReadonly(),
      cachedDataAvailable: cachedSignal.asReadonly(),
    };

    await TestBed.configureTestingModule({
      imports: [AdminOfflineBannerComponent],
      providers: [
        { provide: OfflineAdminStorageService, useValue: storageMock },
        {
          provide: I18nService,
          useValue: {
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOfflineBannerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should hide the banner when online', () => {
    onlineSignal.set(true);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner).toBeNull();
  });

  it('should show the banner when offline', () => {
    onlineSignal.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('admin.offline.banner');
  });

  it('should show cached data available message when offline with cache', () => {
    onlineSignal.set(false);
    cachedSignal.set(true);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner.textContent).toContain('admin.offline.cachedDataAvailable');
  });

  it('should have aria-live assertive', () => {
    onlineSignal.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
  });

  it('should update visibility when connectivity changes', () => {
    onlineSignal.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    onlineSignal.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});