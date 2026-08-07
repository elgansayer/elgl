import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

describe('EscrowPaymentsComponent', () => {
  let component: EscrowPaymentsComponent;
  let fixture: ComponentFixture<EscrowPaymentsComponent>;
  let mockAuthService: { getAccessToken: ReturnType<typeof vi.fn> };
  let mockI18nService: { translate: ReturnType<typeof vi.fn>; currentLang: ReturnType<typeof signal>; direction: ReturnType<typeof signal> };
  let mockOnboardingService: { isCompleted: ReturnType<typeof vi.fn>; isTourInProgress: ReturnType<typeof signal>; markComplete: ReturnType<typeof vi.fn> };

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
    };

    await TestBed.configureTestingModule({
      imports: [EscrowPaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
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
    expect(component.showCreateForm()).toBe(false);
    expect(component.showDisputeForm()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(component.successMessage()).toBeNull();
  });

  it('should set status filter', () => {
    component.selectedStatus.set('pending');
    expect(component.selectedStatus()).toBe('pending');
    component.selectedStatus.set('all');
    expect(component.selectedStatus()).toBe('all');
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
  });

  it('should return service type label using i18n', () => {
    const label = component.getServiceTypeLabel('lesson');
    expect(label).toBe('escrow.serviceType.lesson');
  });

  it('should return status filters', () => {
    expect(component.statusFilters.map(f => f.value)).toContain('all');
    expect(component.statusFilters.map(f => f.value)).toContain('pending');
  });

  it('should verify RTL logical CSS properties', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
    expect(componentHtml).not.toMatch(/\bleft-\d/);
    expect(componentHtml).not.toMatch(/\bright-\d/);
    expect(componentHtml).toMatch(/\bps-\d/);
    expect(componentHtml).toMatch(/\bpe-\d/);
    expect(componentHtml).toMatch(/\bms-\d/);
    expect(componentHtml).toMatch(/\bme-\d/);
  });
});
