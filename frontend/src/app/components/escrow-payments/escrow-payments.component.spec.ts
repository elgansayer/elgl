<<<<<<< HEAD
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { JoyrideService } from 'ngx-joyride';

describe('EscrowPaymentsComponent', () => {
  let fixture: ComponentFixture<EscrowPaymentsComponent>;
  let component: EscrowPaymentsComponent;
  let httpTesting: HttpTestingController;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };
  let mockAuthService: { getAccessToken: ReturnType<typeof vi.fn> };
  let mockI18nService: { translate: ReturnType<typeof vi.fn> };
  let mockJoyrideService: { startTour: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();

    mockErrorHandler = { handleError: vi.fn() };
    mockAuthService = { getAccessToken: vi.fn().mockReturnValue('test-token') };
    mockI18nService = {
      translate: vi.fn((key: string) => key),
    };
    mockJoyrideService = {
      startTour: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
    };

    TestBed.configureTestingModule({
=======
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
>>>>>>> origin/main
      imports: [EscrowPaymentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
<<<<<<< HEAD
<<<<<<< HEAD
        { provide: ErrorHandler, useValue: mockErrorHandler },
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: JoyrideService, useValue: mockJoyrideService },
      ],
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(EscrowPaymentsComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  // -----------------------------------------------------------------
  // Rendering & Initialisation
  // -----------------------------------------------------------------

=======
        { provide: AuthService, useValue: mockAuthService },
=======
>>>>>>> origin/main
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

>>>>>>> origin/main
  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

<<<<<<< HEAD
  it('should render the title via TranslatePipe', () => {
    const h1 = fixture.nativeElement.querySelector('#escrow-heading');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('escrow.title');
  });

  it('should load transactions on init', () => {
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(component.transactions()).toEqual([]);
  });

  it('should wrap content with error boundary', () => {
    const boundary = fixture.nativeElement.querySelector('app-srs-error-boundary');
    expect(boundary).toBeTruthy();
  });

  // -----------------------------------------------------------------
  // Error Reporting via ErrorHandler
  // -----------------------------------------------------------------

  it('should report errors to GlobalErrorHandler when loadTransactions fails', () => {
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('EscrowPaymentsError');
    expect(reportedError.message).toContain('[Escrow:loadTransactions]');
    expect(component.error()).toContain('escrow.loadError');
  });

  it('should report errors to GlobalErrorHandler when createPayment fails', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.showCreateForm.set(true);
    component.createForm.set({
      partner_id: 'user-456',
      amount: 100,
      description: 'Test payment',
      service_type: 'lesson',
    });
    component.createPayment();

    mockErrorHandler.handleError.mockClear();

    const createReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/create') && r.request.method === 'POST',
    );
    createReq.flush('Bad request', { status: 400, statusText: 'Bad Request' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('EscrowPaymentsError');
    expect(reportedError.message).toContain('[Escrow:createPayment]');
    expect(component.error()).toContain('escrow.createError');
  });

  it('should report errors to GlobalErrorHandler when releasePayment fails', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    mockErrorHandler.handleError.mockClear();

    component.releasePayment('escrow-001');
    const releaseReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/release') && r.request.method === 'POST',
    );
    releaseReq.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.message).toContain('[Escrow:releasePayment]');
    expect(component.error()).toContain('escrow.releaseError');
  });

  it('should report errors to GlobalErrorHandler when refundPayment fails', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.refundPayment('escrow-002');
    const refundReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/refund') && r.request.method === 'POST',
    );
    refundReq.flush('Conflict', { status: 409, statusText: 'Conflict' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.message).toContain('[Escrow:refundPayment]');
    expect(component.error()).toContain('escrow.refundError');
  });

  it('should report errors to GlobalErrorHandler when submitDispute fails', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.showDisputeForm.set('escrow-003');
    component.disputeReason.set('Service not delivered');

    component.submitDispute();
    const disputeReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/dispute') && r.request.method === 'POST',
    );
    disputeReq.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.message).toContain('[Escrow:submitDispute]');
    expect(reportedError.message).toContain('escrow-003');
    expect(component.error()).toContain('escrow.disputeError');
  });

  // -----------------------------------------------------------------
  // Error Context & Retry
  // -----------------------------------------------------------------

  it('should provide escrow payments error context to the error boundary', () => {
    const ctx = component.errorContext();
    expect(ctx.component).toBe('escrow-payments');
    expect(ctx.operation).toBe('payment-management');
  });

  it('should handle retry by clearing messages and reloading transactions', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.error.set('Some error occurred');
    component.successMessage.set('Previous success');

    component.handleRetry();

    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();

    const retryReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    retryReq.flush([
      {
        id: 'escrow-retry',
        sender_id: 'user-me',
        receiver_id: 'user-them',
        amount: 50,
        status: 'pending',
        description: 'Retry loaded',
        service_type: 'other',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    expect(component.transactions().length).toBe(1);
  });

  // -----------------------------------------------------------------
  // Success Paths
  // -----------------------------------------------------------------

  it('should load transactions successfully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    const mockTxs = [
      {
        id: 'tx-1',
        sender_id: 'user-1',
        receiver_id: 'user-2',
        amount: 100,
        status: 'pending' as const,
        description: 'Test escrow',
        service_type: 'lesson' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    initReq.flush(mockTxs);
    expect(component.transactions()).toEqual(mockTxs);
    expect(component.loading()).toBe(false);
  });

  it('should create a payment successfully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.showCreateForm.set(true);
    component.createForm.set({
      partner_id: 'user-456',
      amount: 200,
      description: 'Language exchange',
      service_type: 'language_exchange',
    });

    component.createPayment();

    const createReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/create') && r.request.method === 'POST',
    );
    expect(createReq.request.body).toMatchObject({
      partner_id: 'user-456',
      amount: 200,
      description: 'Language exchange',
    });
    createReq.flush({ id: 'escrow-new' });

    const reloadReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    reloadReq.flush([]);

    expect(component.successMessage()).toContain('escrow.createSuccess');
    expect(component.showCreateForm()).toBe(false);
  });

  it('should release a payment successfully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.releasePayment('escrow-release');

    const releaseReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/release') && r.request.method === 'POST',
    );
    releaseReq.flush({ status: 'released' });

    const reloadReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    reloadReq.flush([]);

    expect(component.successMessage()).toContain('escrow.releaseSuccess');
  });

  it('should refund a payment successfully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.refundReason.set('Changed my mind');
    component.refundPayment('escrow-refund');

    const refundReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/refund') && r.request.method === 'POST',
    );
    expect(refundReq.request.body).toMatchObject({
      escrow_id: 'escrow-refund',
      reason: 'Changed my mind',
    });
    refundReq.flush({ status: 'refunded' });

    const reloadReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    reloadReq.flush([]);

    expect(component.successMessage()).toContain('escrow.refundSuccess');
    expect(component.refundReason()).toBe('');
  });

  it('should submit a dispute successfully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    component.showDisputeForm.set('escrow-dispute');
    component.disputeReason.set('Service incomplete');
    component.disputeEvidence.set('Screenshots attached');

    component.submitDispute();

    const disputeReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/dispute') && r.request.method === 'POST',
    );
    expect(disputeReq.request.body).toMatchObject({
      escrow_id: 'escrow-dispute',
      reason: 'Service incomplete',
      evidence: 'Screenshots attached',
    });
    disputeReq.flush({ status: 'disputed' });

    const reloadReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    reloadReq.flush([]);

    expect(component.successMessage()).toContain('escrow.disputeSuccess');
    expect(component.showDisputeForm()).toBeNull();
    expect(component.disputeReason()).toBe('');
    expect(component.disputeEvidence()).toBe('');
  });

  // -----------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------

  it('should filter transactions by status', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    const txs = [
      { id: '1', sender_id: 'u1', receiver_id: 'u2', amount: 10, status: 'pending', description: 'D1', service_type: 'other', created_at: '', updated_at: '' },
      { id: '2', sender_id: 'u1', receiver_id: 'u3', amount: 20, status: 'released', description: 'D2', service_type: 'lesson', created_at: '', updated_at: '' },
      { id: '3', sender_id: 'u4', receiver_id: 'u1', amount: 30, status: 'pending', description: 'D3', service_type: 'translation', created_at: '', updated_at: '' },
    ] as const;
    initReq.flush(txs as unknown as []);

    expect(component.filteredTransactions().length).toBe(3);

    component.setStatusFilter('pending');
    expect(component.filteredTransactions().length).toBe(2);

    component.setStatusFilter('released');
    expect(component.filteredTransactions().length).toBe(1);

    component.setStatusFilter('disputed');
    expect(component.filteredTransactions().length).toBe(0);

    component.setStatusFilter('all');
    expect(component.filteredTransactions().length).toBe(3);
  });

  it('should compute accurate status counts', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    const txs = [
      { id: '1', sender_id: 'u1', receiver_id: 'u2', amount: 10, status: 'pending', description: 'D1', service_type: 'other', created_at: '', updated_at: '' },
      { id: '2', sender_id: 'u1', receiver_id: 'u3', amount: 20, status: 'pending', description: 'D2', service_type: 'lesson', created_at: '', updated_at: '' },
      { id: '3', sender_id: 'u1', receiver_id: 'u4', amount: 30, status: 'released', description: 'D3', service_type: 'proofreading', created_at: '', updated_at: '' },
    ] as const;
    initReq.flush(txs as unknown as []);

    const counts = component.statusCounts();
    expect(counts.all).toBe(3);
    expect(counts.pending).toBe(2);
    expect(counts.released).toBe(1);
    expect(counts.disputed).toBe(0);
    expect(component.pendingCount()).toBe(2);
  });

  // -----------------------------------------------------------------
  // Validation & Edge Cases
  // -----------------------------------------------------------------

  it('should not create payment when form is invalid', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    mockErrorHandler.handleError.mockClear();

    component.createForm.set({ partner_id: '', amount: 100, description: 'Test', service_type: 'other' });
    component.createPayment();
    expect(mockErrorHandler.handleError).not.toHaveBeenCalled();

    component.createForm.set({ partner_id: 'user-1', amount: 0, description: 'Test', service_type: 'other' });
    component.createPayment();
    expect(mockErrorHandler.handleError).not.toHaveBeenCalled();

    component.createForm.set({ partner_id: 'user-1', amount: 100, description: '', service_type: 'other' });
    component.createPayment();
    expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
  });

  it('should not submit dispute when reason is empty', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    mockErrorHandler.handleError.mockClear();

    component.showDisputeForm.set('escrow-1');
    component.disputeReason.set('');
    component.submitDispute();

    expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
    expect(httpTesting.match(() => true).length).toBe(0);
  });

  it('should clear messages', () => {
    component.error.set('An error');
    component.successMessage.set('A success');
=======
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
>>>>>>> origin/main
    component.clearMessages();
    expect(component.error()).toBeNull();
    expect(component.successMessage()).toBeNull();
  });

<<<<<<< HEAD
<<<<<<< HEAD
  it('should handle empty response gracefully', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush(null);
    expect(component.transactions()).toEqual([]);
  });

  it('should report network errors correctly', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    const progressEvent = new ProgressEvent('error', { loaded: 0, total: 0 });
    initReq.error(progressEvent);

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('EscrowPaymentsError');
    expect(component.error()).toContain('escrow.loadError');
  });

  it('should include escrowId in error report when available', () => {
    const initReq = httpTesting.expectOne((r) =>
      r.url.includes('/escrow') && r.request.method === 'GET'
    );
    initReq.flush([]);

    mockErrorHandler.handleError.mockClear();

    component.releasePayment('escrow-specific-123');
    const releaseReq = httpTesting.expectOne(
      (r) => r.url.includes('/escrow/release') && r.request.method === 'POST',
    );
    releaseReq.flush('Gone', { status: 410, statusText: 'Gone' });

    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error & { escrowOperation?: string; escrowId?: string };
    expect(reportedError.escrowId).toBe('escrow-specific-123');
  });

  // -----------------------------------------------------------------
  // Status Label & Class Helpers
  // -----------------------------------------------------------------

  it('should return correct status labels', () => {
    expect(component.getStatusLabel('pending')).toContain('escrow.status.pending');
    expect(component.getStatusLabel('released')).toContain('escrow.status.released');
    expect(component.getStatusLabel('disputed')).toContain('escrow.status.disputed');
    expect(component.getStatusLabel('refunded')).toContain('escrow.status.refunded');
    expect(component.getStatusLabel('cancelled')).toContain('escrow.status.cancelled');
  });

  it('should return status classes with valid CSS class names', () => {
    const pendingClass = component.getStatusClass('pending');
    expect(pendingClass).toContain('bg-amber');

    const releasedClass = component.getStatusClass('released');
    expect(releasedClass).toContain('bg-emerald');

    const disputedClass = component.getStatusClass('disputed');
    expect(disputedClass).toContain('bg-rose');

    const refundedClass = component.getStatusClass('refunded');
    expect(refundedClass).toContain('bg-slate');

    const cancelledClass = component.getStatusClass('cancelled');
    expect(cancelledClass).toContain('bg-zinc');
  });

  it('should return service type labels', () => {
    expect(component.getServiceTypeLabel('lesson')).toContain('escrow.serviceType.lesson');
    expect(component.getServiceTypeLabel('language_exchange')).toContain('escrow.serviceType.language_exchange');
=======
  it('should return status filters', () => {
    expect(component.statusFilters).toContain('all');
    expect(component.statusFilters).toContain('pending');
=======
  it('should delegate release to escrow service', async () => {
    await component.handleRelease('test-escrow-id');
    expect(mockEscrowService.releaseEscrow).toHaveBeenCalledWith('test-escrow-id');
>>>>>>> origin/main
  });

  it('should delegate refund to escrow service', async () => {
    await component.handleRefund('test-escrow-id');
    expect(mockEscrowService.refundEscrow).toHaveBeenCalledWith('test-escrow-id');
  });

<<<<<<< HEAD
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
>>>>>>> origin/main
=======
  it('should navigate back on goBack', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
>>>>>>> origin/main
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