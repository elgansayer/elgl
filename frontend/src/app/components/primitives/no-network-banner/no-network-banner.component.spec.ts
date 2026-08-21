import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';

import { NoNetworkBannerComponent } from './no-network-banner.component';
import { NetworkStatusService } from '../../../services/network-status.service';
import { I18nService } from '../../../services/i18n.service';

describe('NoNetworkBannerComponent', () => {
  let component: NoNetworkBannerComponent;
  let fixture: ComponentFixture<NoNetworkBannerComponent>;
  let onlineSignal: ReturnType<typeof signal<boolean>>;
  let networkStatusMock: Partial<NetworkStatusService>;

  beforeEach(async () => {
    onlineSignal = signal<boolean>(true);

    networkStatusMock = {
      isOnline: onlineSignal.asReadonly(),
    };

    const i18nMock = {
      translate: vi.fn((key: string) => {
        if (key === 'no_network_banner.message') return 'No network connection';
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [NoNetworkBannerComponent],
      providers: [
        { provide: NetworkStatusService, useValue: networkStatusMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NoNetworkBannerComponent);
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
    expect(banner.textContent).toContain('No network connection');
  });

  it('should have aria-live assertive for accessibility', () => {
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