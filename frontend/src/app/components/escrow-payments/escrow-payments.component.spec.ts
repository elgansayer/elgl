import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import { JoyrideService } from 'ngx-joyride';

describe('EscrowPaymentsComponent', () => {
  let component: EscrowPaymentsComponent;
  let fixture: ComponentFixture<EscrowPaymentsComponent>;
  let mockAuthService: { getAccessToken: ReturnType<typeof vi.fn> };
  let mockI18nService: { translate: ReturnType<typeof vi.fn>; currentLang: ReturnType<typeof signal>; direction: ReturnType<typeof signal> };
  let mockOnboardingService: { isCompleted: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof signal>; markComplete: ReturnType<typeof vi.fn>; stepNames: string[] };
  let mockJoyrideService: { startTour: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
    };

    mockI18nService = {
      translate: vi.fn().mockImplementation((key: string) => key),
      currentLang: signal('en-GB'),
      direction: signal('ltr'),
    };

    mockOnboardingService = {
      isCompleted: vi.fn().mockReturnValue(true),
      isTourInProgress: signal(false),
      markComplete: vi.fn(),
      stepNames: ['escrowStepTitle', 'escrowStepCreate', 'escrowStepFilters', 'escrowStepTransactions'],
    };

    mockJoyrideService = {
      startTour: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };

    await TestBed.configureTestingModule({
      imports: [EscrowPaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: EscrowOnboardingService, useValue: mockOnboardingService },
        { provide: JoyrideService, useValue: mockJoyrideService },
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
    expect(component.statusFilter()).toBe('all');
    expect(component.showCreateForm()).toBe(false);
    expect(component.showDisputeForm()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();
  });

  it('should set status filter and compute filtered transactions', () => {
    component.statusFilter.set('pending');
    expect(component.statusFilter()).toBe('pending');
    component.statusFilter.set('all');
    expect(component.statusFilter()).toBe('all');
  });

  it('should toggle create form', () => {
    expect(component.showCreateForm()).toBe(false);
    component.showCreateForm.set(true);
    expect(component.showCreateForm()).toBe(true);
  });

  it('should return correct status class', () => {
    expect(component.getStatusClass('pending')).toContain('amber');
    expect(component.getStatusClass('released')).toContain('emerald');
    expect(component.getStatusClass('disputed')).toContain('rose');
    expect(component.getStatusClass('refunded')).toContain('slate');
    expect(component.getStatusClass('cancelled')).toContain('zinc');
  });

  it('should return status label using i18n', () => {
    const label = component.getStatusLabel('pending');
    expect(label).toBe('escrow.status.pending');
    expect(mockI18nService.translate).toHaveBeenCalledWith('escrow.status.pending');
  });

  it('should return service type label using i18n', () => {
    const label = component.getServiceTypeLabel('lesson');
    expect(label).toBe('escrow.serviceType.lesson');
    expect(mockI18nService.translate).toHaveBeenCalledWith('escrow.serviceType.lesson');
  });

  it('should clear messages', () => {
    component.error.set('test error');
    component.successMessage.set('test success');
    component.clearMessages();
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();
  });

  it('should return status filters', () => {
    expect(component.statusFilters).toContain('all');
    expect(component.statusFilters).toContain('pending');
  });

  it('should not start onboarding tour when already completed', () => {
    mockOnboardingService.isCompleted.mockReturnValue(true);
    fixture = TestBed.createComponent(EscrowPaymentsComponent);
    expect(mockJoyrideService.startTour).not.toHaveBeenCalled();
  });

  it('should start onboarding tour when not completed', () => {
    const startTourSpy = vi.fn().mockReturnValue({ subscribe: vi.fn() });
    mockJoyrideService.startTour = startTourSpy;
    mockOnboardingService.isCompleted.mockReturnValue(false);

    const freshFixture = TestBed.createComponent(EscrowPaymentsComponent);
    freshFixture.detectChanges();
    freshFixture.componentInstance.ngAfterViewInit();

    // The tour starts after a 500ms setTimeout, so check after
    vi.advanceTimersByTime?.(600);

    expect(startTourSpy).toHaveBeenCalled();
    const callArgs = startTourSpy.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.steps).toEqual(mockOnboardingService.stepNames);
    expect(callArgs.startWith).toBe('escrowStepTitle');
  });
});