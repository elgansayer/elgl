import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { EscrowService } from '../../services/escrow.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

describe('EscrowPaymentsComponent', () => {
  let component: EscrowPaymentsComponent;
  let fixture: ComponentFixture<EscrowPaymentsComponent>;
  let mockAuthService: { getAccessToken: ReturnType<typeof vi.fn> };
  let mockI18nService: { translate: ReturnType<typeof vi.fn>; currentLang: ReturnType<typeof signal>; direction: ReturnType<typeof signal> };
  let mockEscrowService: {
    listEscrows: ReturnType<typeof vi.fn>;
    releaseEscrow: ReturnType<typeof vi.fn>;
    refundEscrow: ReturnType<typeof vi.fn>;
    disputeEscrow: ReturnType<typeof vi.fn>;
    syncOfflineOperations: ReturnType<typeof vi.fn>;
    pendingOperationCount: ReturnType<typeof signal>;
  };
  let mockNetworkService: { isOnline: ReturnType<typeof signal> };
  let mockOnboardingService: { isCompleted: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof signal>; markComplete: ReturnType<typeof vi.fn>; stepNames: string[]; startTour: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
    };

    mockI18nService = {
      translate: vi.fn().mockImplementation((key: string) => key),
      currentLang: signal('en-GB'),
      direction: signal('ltr'),
    };

    mockEscrowService = {
      listEscrows: vi.fn().mockResolvedValue([]),
      releaseEscrow: vi.fn().mockResolvedValue({ id: '1', status: 'released' }),
      refundEscrow: vi.fn().mockResolvedValue({ id: '1', status: 'refunded' }),
      disputeEscrow: vi.fn().mockResolvedValue({}),
      syncOfflineOperations: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
      pendingOperationCount: signal(0),
    };

    mockNetworkService = {
      isOnline: signal(true),
    };

    mockOnboardingService = {
      isCompleted: vi.fn().mockReturnValue(true),
      isTourInProgress: signal(false),
      markComplete: vi.fn(),
      stepNames: ['escrowStepTitle', 'escrowStepCreate', 'escrowStepFilters', 'escrowStepTransactions'],
      startTour: vi.fn(),
    };


    await TestBed.configureTestingModule({
      imports: [EscrowPaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EscrowService, useValue: mockEscrowService },
        { provide: NetworkStatusService, useValue: mockNetworkService },
        { provide: EscrowOnboardingService, useValue: mockOnboardingService },
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

  it('should toggle create form', () => {
  });

  it('should return correct status badge class', () => {
    expect(component.statusBadgeClass('pending')).toContain('warning');
    expect(component.statusBadgeClass('released')).toContain('success');
    expect(component.statusBadgeClass('disputed')).toContain('danger');
    expect(component.statusBadgeClass('refunded')).toContain('text-secondary');
    expect(component.statusBadgeClass('cancelled')).toContain('text-muted');
  });

  it('should return status filters with labels', () => {
    expect(component.statusFilters).toHaveLength(6);
    expect(component.statusFilters[0]).toEqual({ value: 'all', label: 'escrow.status.all' });
    expect(component.statusFilters[1]).toEqual({ value: 'pending', label: 'escrow.status.pending' });
  });

  it('should not start onboarding tour when already completed', () => {
    mockOnboardingService.isCompleted.mockReturnValue(true);
    fixture = TestBed.createComponent(EscrowPaymentsComponent);
  });
});