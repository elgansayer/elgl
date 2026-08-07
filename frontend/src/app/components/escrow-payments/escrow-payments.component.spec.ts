import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { I18nService } from '../../services/i18n.service';
import { EscrowService } from '../../services/escrow.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

describe('EscrowPaymentsComponent', () => {
  let component: EscrowPaymentsComponent;
  let fixture: ComponentFixture<EscrowPaymentsComponent>;
  let mockI18nService: { translate: ReturnType<typeof vi.fn> };
  let mockEscrowService: { escrows: ReturnType<typeof signal>; loading: ReturnType<typeof signal>; pendingOperationCount: ReturnType<typeof signal>; listUserEscrows: ReturnType<typeof vi.fn>; releaseEscrow: ReturnType<typeof vi.fn>; refundEscrow: ReturnType<typeof vi.fn>; disputeEscrow: ReturnType<typeof vi.fn>; syncOfflineOperations: ReturnType<typeof vi.fn> };
  let mockNetworkService: { isOnline: ReturnType<typeof signal> };
  let mockOnboardingService: { isCompleted: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof signal>; markComplete: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockI18nService = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    mockEscrowService = {
      escrows: signal([]),
      loading: signal(false),
      pendingOperationCount: signal(0),
      listUserEscrows: vi.fn().mockResolvedValue([]),
      releaseEscrow: vi.fn().mockResolvedValue({}),
      refundEscrow: vi.fn().mockResolvedValue({}),
      disputeEscrow: vi.fn().mockResolvedValue({}),
      syncOfflineOperations: vi.fn().mockResolvedValue({}),
    };

    mockNetworkService = {
      isOnline: signal(true),
    };

    mockOnboardingService = {
      isCompleted: vi.fn().mockReturnValue(true),
      isTourInProgress: signal(false),
      markComplete: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EscrowPaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: mockI18nService },
        { provide: EscrowService, useValue: mockEscrowService },
        { provide: NetworkStatusService, useValue: mockNetworkService },
        { provide: EscrowOnboardingService, useValue: mockOnboardingService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EscrowPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with default signal values', () => {
    expect(component.selectedStatus()).toBe('all');
    expect(component.actionInProgress()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();
  });

  it('should set status filter', () => {
    component.setStatusFilter('pending');
    expect(component.selectedStatus()).toBe('pending');
    component.setStatusFilter('all');
    expect(component.selectedStatus()).toBe('all');
  });

  it('should have status filters', () => {
    expect(component.statusFilters).toHaveLength(6);
    expect(component.statusFilters[0].value).toBe('all');
    expect(component.statusFilters[1].value).toBe('pending');
  });

  it('should return correct status badge class', () => {
    expect(component.statusBadgeClass('pending')).toContain('amber');
    expect(component.statusBadgeClass('released')).toContain('emerald');
    expect(component.statusBadgeClass('disputed')).toContain('rose');
    expect(component.statusBadgeClass('refunded')).toContain('slate');
    expect(component.statusBadgeClass('cancelled')).toContain('zinc');
  });

  it('should clear messages', () => {
    component.error.set('test error');
    component.successMessage.set('test success');
    component.clearMessages();
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();
  });

  it('should delegate release to escrow service', async () => {
    await component.handleRelease('test-escrow-id');
    expect(mockEscrowService.releaseEscrow).toHaveBeenCalledWith('test-escrow-id');
  });

  it('should delegate refund to escrow service', async () => {
    await component.handleRefund('test-escrow-id');
    expect(mockEscrowService.refundEscrow).toHaveBeenCalledWith('test-escrow-id');
  });

  it('should navigate back on goBack', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-) are used instead of physical direction classes', () => {
    const componentHtml = fixture.nativeElement.innerHTML;

    // Physical direction classes must NOT appear
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);

    // Physical border classes must NOT appear
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);

    // Physical position classes must NOT appear
    expect(componentHtml).not.toMatch(/\bleft-\d/);
    expect(componentHtml).not.toMatch(/\bright-\d/);

    // Logical direction classes SHOULD appear
    expect(componentHtml).toMatch(/\bps-\d/);
    expect(componentHtml).toMatch(/\bpe-\d/);
    expect(componentHtml).toMatch(/\bms-\d/);
    expect(componentHtml).toMatch(/\bme-\d/);
  });
});