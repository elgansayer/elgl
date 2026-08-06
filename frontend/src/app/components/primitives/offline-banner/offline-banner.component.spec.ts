import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { OfflineBannerComponent } from './offline-banner.component';
import { NetworkStatusService } from '../../../services/network-status.service';

describe('OfflineBannerComponent', () => {
  const isOnline = signal<boolean>(true);
  let fixture: ComponentFixture<OfflineBannerComponent>;

  beforeAll(async () => {
    await TestBed.configureTestingModule({
      imports: [OfflineBannerComponent],
      providers: [
        {
          provide: NetworkStatusService,
          useValue: { isOnline: isOnline.asReadonly() },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    isOnline.set(true);
    fixture = TestBed.createComponent(OfflineBannerComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not show banner when online', () => {
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner).toBeNull();
  });

  it('should show banner when offline', () => {
    isOnline.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('No network connection');
  });

  it('should have aria-live assertive for accessibility', () => {
    isOnline.set(false);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[role="alert"]');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
  });
});