import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { DeveloperDashboardComponent } from './developer-dashboard.component';
import { EconomyStore } from '../../services/economy.store';
import { AuthService } from '../../services/auth.service';
import { DiscoveryService } from '../../services/discovery.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { I18nService } from '../../services/i18n.service';

describe('DeveloperDashboardComponent', () => {
  const developerStats = signal(null);
  const diagnosticLogs = signal([]);
  const currentUser = signal(null);
  const isConnected = signal(false);
  const connectionStatus = signal('disconnected');

  const store = {
    developerStats,
    diagnosticLogs,
    loadDeveloperAnalytics: vi.fn().mockResolvedValue(undefined),
    loadDiagnosticLogs: vi.fn().mockResolvedValue(undefined),
    upgradeVip: vi.fn().mockResolvedValue(undefined),
    generateApiKey: vi.fn().mockResolvedValue(undefined),
    createDiagnosticLog: vi.fn().mockResolvedValue(undefined),
  };

  const authService = { currentUser };
  const discoveryService = { findPartners: vi.fn().mockResolvedValue([]) };
  const centrifugeService = {
    isConnected,
    connectionStatus,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    developerStats.set(null);
    diagnosticLogs.set([]);
    currentUser.set(null);
    isConnected.set(false);
    connectionStatus.set('disconnected');

    await TestBed.configureTestingModule({
      imports: [DeveloperDashboardComponent],
      providers: [
        { provide: EconomyStore, useValue: store },
        { provide: AuthService, useValue: authService },
        { provide: DiscoveryService, useValue: discoveryService },
        { provide: CentrifugeService, useValue: centrifugeService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  it('delegates sandbox selection and panel semantics to Spartan Tabs', async () => {
    const fixture = TestBed.createComponent(DeveloperDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const tabList = host.querySelector<HTMLElement>('[role="tablist"]');
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(host.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

    expect(tabList).not.toBeNull();
    expect(tabs).toHaveLength(4);
    expect(panels).toHaveLength(4);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(fixture.componentInstance.activeTab()).toBe('overview');

    tabs[1]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('postgis');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
  });

  it('uses Spartan keyboard navigation instead of feature-owned key handlers', async () => {
    const fixture = TestBed.createComponent(DeveloperDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const overview = tabs[0];
    const postgis = tabs[1];

    overview?.focus();
    overview?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(postgis);
    expect(fixture.componentInstance.activeTab()).toBe('postgis');
  });
});