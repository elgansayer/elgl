import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RestorePurchasesButtonComponent } from './restore-purchases-button.component';
import { RestorePurchasesService } from '../../services/restore-purchases.service';
import { I18nService } from '../../services/i18n.service';

describe('RestorePurchasesButtonComponent', () => {
  let component: RestorePurchasesButtonComponent;
  let fixture: ComponentFixture<RestorePurchasesButtonComponent>;
  let httpMock: HttpTestingController;
  let restoreService: RestorePurchasesService;

  const mockI18nService = {
    translate: (key: string) => key,
    currentLocale: () => 'en',
    currentDirection: () => 'ltr',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestorePurchasesButtonComponent],
      providers: [
        RestorePurchasesService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: mockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RestorePurchasesButtonComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    restoreService = TestBed.inject(RestorePurchasesService);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('creates in the idle state', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('restore_purchases');
  });

  it('shows a busy state while restoring', () => {
    restoreService.isRestoring.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.animate-spin')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('restoring');
    expect(
      fixture.nativeElement.querySelector('app-button-secondary')?.getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('emits restored only after an authoritative successful restore', async () => {
    const emitted = vi.fn();
    component.restored.subscribe(emitted);
    const restoreSpy = vi.spyOn(restoreService, 'restorePurchases').mockResolvedValue({
      success: true,
      restoredPlans: ['consumer'],
      message: 'restorePurchases.success',
      status: 'restored',
      platform: 'stripe',
      tier: 'consumer',
    });

    await component.onRestore();

    expect(restoreSpy).toHaveBeenCalledOnce();
    expect(emitted).toHaveBeenCalledOnce();
  });

  it('does not emit restored for no-subscription or failure outcomes', async () => {
    const emitted = vi.fn();
    component.restored.subscribe(emitted);
    vi.spyOn(restoreService, 'restorePurchases').mockResolvedValue({
      success: false,
      restoredPlans: [],
      message: 'restorePurchases.noSubscriptionFound',
      status: 'no_valid_subscription',
      platform: 'stripe',
    });

    await component.onRestore();

    expect(emitted).not.toHaveBeenCalled();
  });

  it('ignores a second activation while a restore is already in progress', async () => {
    restoreService.isRestoring.set(true);
    const restoreSpy = vi.spyOn(restoreService, 'restorePurchases');

    await component.onRestore();

    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('announces the latest restore result through a polite live region', () => {
    restoreService.lastRestoreResult.set({
      success: false,
      restoredPlans: [],
      message: 'restorePurchases.failed',
      status: 'failed',
      platform: 'stripe',
    });
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('restorePurchases.failed');
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });
});
