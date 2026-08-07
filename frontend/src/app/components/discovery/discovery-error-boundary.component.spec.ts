import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiscoveryErrorBoundaryComponent } from './discovery-error-boundary.component';

const ANALYTICS_URL = 'http://localhost:3000/api/analytics/client-error';

function flushCapture(req: ReturnType<HttpTestingController['expectOne']>): void {
  req.flush({ status: 'logged' });
}

describe('DiscoveryErrorBoundaryComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiscoveryErrorBoundaryComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    expect(component).toBeDefined();
  });

  it('should render projected content when no error', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')).toBeNull();
  });

  it('should show error UI when an error is captured', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Discovery map failed to load'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')).toBeTruthy();
    expect(compiled.textContent).toContain('discoveryErrorBoundary.title');
    expect(compiled.textContent).toContain('Discovery map failed to load');

    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
  });

  it('should POST crash to analytics when captureError is called', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Partner search crashed'), undefined, { action: 'searchPartners' });

    const req = httpTesting.expectOne(ANALYTICS_URL);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Partner search crashed');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['feature']).toBe('discovery');
    expect(metadata['component']).toBe('DiscoveryMap');
    expect(metadata['renderingError']).toBe(true);
    expect(metadata['action']).toBe('searchPartners');
    flushCapture(req);
  });

  it('should reset error state and emit retry event', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;

    let retried = false;
    component.retry.subscribe(() => { retried = true; });

    fixture.detectChanges();

    component.captureError(new Error('Temporary glitch'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
    expect(component.hasError()).toBe(true);
    expect(component.errorCount()).toBe(1);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect(component.reportConfirmed()).toBe(false);
    expect(component.errorCount()).toBe(0);
    expect(retried).toBe(true);
  });

  it('should increment error count on repeated captures', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Error 1'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
    component.captureError(new Error('Error 2'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
    component.captureError(new Error('Error 3'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));

    expect(component.errorCount()).toBe(3);
    expect(component.errorDetailHint()).toContain('Error count: 3');
  });

  it('should report manual crash when reportCrash is called', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Initial error'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));

    component.reportCrash();
    fixture.detectChanges();

    const req = httpTesting.expectOne(ANALYTICS_URL);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['action']).toBe('manualReport');
    flushCapture(req);

    expect(component.reportConfirmed()).toBe(true);
  });

  it('should show error detail hint when error count > 1', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('First error'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
    component.captureError(new Error('Second error'));
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Error count: 2');
  });

  it('should use custom message override when provided', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Raw error'), 'User-friendly discovery error message');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('User-friendly discovery error message');
    flushCapture(httpTesting.expectOne(ANALYTICS_URL));
  });
});