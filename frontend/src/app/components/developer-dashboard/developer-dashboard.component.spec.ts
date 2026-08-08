import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { DeveloperDashboardComponent } from './developer-dashboard.component';
import { EconomyStore } from '../../services/economy.store';
import { AuthService } from '../../services/auth.service';
import { CentrifugeService } from '../../services/centrifuge.service';
import { DiscoveryService } from '../../services/discovery.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

describe('DeveloperDashboardComponent', () => {
  let component: DeveloperDashboardComponent;

  const mockEconomyStore = {
    developerStats: signal(null),
    diagnosticLogs: signal([]),
    upgradeVip: vi.fn(),
    generateApiKey: vi.fn(),
    loadDeveloperAnalytics: vi.fn(),
    loadDiagnosticLogs: vi.fn(),
    createDiagnosticLog: vi.fn(),
  };

  const mockAuthService = {
    currentUser: signal({ id: 'u1', is_vip: false, vip_tier: 'free' }),
  };

  const mockCentrifugeService = {
    isConnected: vi.fn(() => false),
    connectionStatus: signal('disconnected'),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  const mockDiscoveryService = {
    findPartners: vi.fn(),
  };

  const mockI18nService = {
    translate: vi.fn((key: string) => key),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeveloperDashboardComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EconomyStore, useValue: mockEconomyStore },
        { provide: AuthService, useValue: mockAuthService },
        { provide: CentrifugeService, useValue: mockCentrifugeService },
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DeveloperDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should default to overview tab', () => {
    expect(component.activeTab()).toBe('overview');
  });

  it('should change active tab when setTab is called', () => {
    component.setTab('postgis');
    expect(component.activeTab()).toBe('postgis');
    component.setTab('centrifugo');
    expect(component.activeTab()).toBe('centrifugo');
    component.setTab('livekit');
    expect(component.activeTab()).toBe('livekit');
    component.setTab('overview');
    expect(component.activeTab()).toBe('overview');
  });

  it('should call store.upgradeVip with developer tier when upgrade is called', async () => {
    await component.upgrade('developer');
    expect(mockEconomyStore.upgradeVip).toHaveBeenCalledWith('developer');
  });

  it('should call store.upgradeVip with consumer tier when upgrade is called', async () => {
    await component.upgrade('consumer');
    expect(mockEconomyStore.upgradeVip).toHaveBeenCalledWith('consumer');
  });

  it('should call store.generateApiKey when generateKey is called', async () => {
    await component.generateKey();
    expect(mockEconomyStore.generateApiKey).toHaveBeenCalled();
  });

  it('should set searchLatitude and searchLongitude with defaults', () => {
    expect(component.searchLatitude()).toBe(51.5074);
    expect(component.searchLongitude()).toBe(-0.1278);
  });

  it('should set searchRadiusMetres with default', () => {
    expect(component.searchRadiusMetres()).toBe(5000);
  });

  it('should set simulatedStageRole to speaker on stage hand raise', async () => {
    await component.simulateStageHandRaise();
    expect(component.simulatedStageRole()).toBe('speaker');
    expect(component.simulatedCanPublish()).toBe(true);
  });

  it('should set simulatedStageRole to listener on stage demote', async () => {
    await component.simulateStageDemote();
    expect(component.simulatedStageRole()).toBe('listener');
    expect(component.simulatedCanPublish()).toBe(false);
  });

  it('should toggle recording state', async () => {
    expect(component.isRecordingActive()).toBe(false);
    await component.toggleRecordingArchive();
    expect(component.isRecordingActive()).toBe(true);
    await component.toggleRecordingArchive();
    expect(component.isRecordingActive()).toBe(false);
  });
});