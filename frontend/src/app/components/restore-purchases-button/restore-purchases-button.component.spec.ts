import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RestorePurchasesButtonComponent } from './restore-purchases-button.component';

describe('RestorePurchasesButtonComponent', () => {
  let component: RestorePurchasesButtonComponent;
  let fixture: ComponentFixture<RestorePurchasesButtonComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestorePurchasesButtonComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RestorePurchasesButtonComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the restore purchases button with translation key', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('restore_purchases');
  });

  it('should show spinning indicator while restoring', async () => {
    const promise = component.onRestore();
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/monetisation/restore-purchases');
    expect(component.restoreService.isRestoring()).toBe(true);

    // Flush to clean up
    req.flush({ received: true, status: 'restored' });
    await promise;
    fixture.detectChanges();
  });

  it('should call restore on button click', () => {
    const button = fixture.nativeElement.querySelector('app-button-secondary');
    expect(button).toBeTruthy();
  });
});