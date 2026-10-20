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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display restore purchases text when not restoring', () => {
    expect(fixture.nativeElement.textContent).toContain('restore_purchases');
  });

  it('should show loading spinner when isRestoring is true', () => {
    restoreService.isRestoring.set(true);
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('restoring');
  });

  it('should call restorePurchases on button click', () => {
    const restoreSpy = vi.spyOn(restoreService, 'restorePurchases').mockResolvedValue({
      success: true,
      restoredPlans: [],
      message: 'test',
    });
    const button = fixture.nativeElement.querySelector('app-button-secondary');
    button.dispatchEvent(new Event('clicked'));
    expect(restoreSpy).toHaveBeenCalledOnce();
  });

  it('should disable button when isRestoring is true', () => {
    restoreService.isRestoring.set(true);
    fixture.detectChanges();
    expect(restoreService.isRestoring()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('restoring');
  });
});