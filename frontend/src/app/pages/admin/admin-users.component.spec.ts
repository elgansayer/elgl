import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService } from '../../services/admin.service';
import { OfflineAdminStorageService } from '../../services/offline-admin-storage.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { I18nService } from '../../services/i18n.service';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    onlineSignal = signal(true);

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
            getLoginHistory: vi.fn().mockResolvedValue([]),
            setVipStatus: vi.fn().mockResolvedValue({}),
            banUser: vi.fn().mockResolvedValue({ message: 'User banned' }),
            warnUser: vi.fn().mockResolvedValue({ message: 'User warned' }),
          },
        },
        {
          provide: OfflineAdminStorageService,
          useValue: {
            isOnline: onlineSignal.asReadonly(),
            cachedDataAvailable: signal(false).asReadonly(),
            cacheUsers: vi.fn(),
            getCachedUsers: vi.fn().mockResolvedValue(null),
            cacheLoginHistory: vi.fn(),
            getCachedLoginHistory: vi.fn().mockResolvedValue(null),
          },
        },
        { provide: NetworkStatusService, useValue: { isOnline: onlineSignal.asReadonly() } },
        { provide: I18nService, useValue: { translate: vi.fn((k: string) => k) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show offline banner when offline', () => {
    onlineSignal.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('app-admin-offline-banner');
    expect(banner).toBeTruthy();
  });
});
