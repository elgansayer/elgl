import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiscoveryErrorBoundaryComponent, DiscoveryErrorContext } from './discovery-error-boundary.component';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { By } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-test-discovery-host',
  template: `
    <app-discovery-error-boundary
      [context]="boundaryContext()"
      [showReportButton]="true"
      (retry)="onRetry()"
      (reportError)="onReportError($event)"
    >
      <div class="child-content">Discovery content here</div>
    </app-discovery-error-boundary>
  `,
  imports: [DiscoveryErrorBoundaryComponent],
})
class TestDiscoveryHostComponent {
  readonly boundaryContext = signal<DiscoveryErrorContext>({
    component: 'discovery-map',
    filterType: 'all',
    targetLanguage: 'JA',
    partnerCount: 0,
  });
  retryCount = 0;
  lastReportedError: DiscoveryErrorContext | null = null;

  onRetry(): void {
    this.retryCount++;
  }
  onReportError(ctx: DiscoveryErrorContext): void {
    this.lastReportedError = ctx;
  }
}

describe('DiscoveryErrorBoundaryComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiscoveryErrorBoundaryComponent, TestDiscoveryHostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: GlobalErrorHandler,
          useValue: { handleError: vi.fn() },
        },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    expect(fixture.componentInstance).toBeDefined();
  });

  it('should render child content when no error', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('discoveryErrorBoundary.title');
  });

  it('should display fallback UI when an error is captured', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Discovery partners search failed'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')?.textContent).toContain('Discovery is unavailable');
    expect(compiled.textContent).toContain('Discovery partners search failed');
  });

  it('should reset error state when resetError is called', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Temporary error'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
  });

  it('should POST to analytics when an error is captured', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const testError = new Error('Discovery rendering failure');
    component.captureError(testError);

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toContain('Discovery rendering failure');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('discovery');
    expect(metadata['renderingError']).toBe(true);
    expect(metadata['boundaryContext']).toBe('unknown');
    req.flush({ status: 'logged' });
  });

  it('should include context metadata in crash report', () => {
    const hostFixture = TestBed.createComponent(TestDiscoveryHostComponent);
    hostFixture.componentInstance.boundaryContext.set({
      component: 'partner-search',
      filterType: 'nearby',
      targetLanguage: 'FR',
      partnerCount: 12,
      sortMode: 'newest',
      radiusKm: 25,
    });
    hostFixture.detectChanges();
    const component = hostFixture.debugElement.query(By.directive(DiscoveryErrorBoundaryComponent)).componentInstance;

    component.captureError(new Error('Filter collapse error'));
    hostFixture.detectChanges();

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('discovery');
    expect(metadata['filterType']).toBe('nearby');
    expect(metadata['targetLanguage']).toBe('FR');
    expect(metadata['partnerCount']).toBe(12);
    expect(metadata['sortMode']).toBe('newest');
    expect(metadata['radiusKm']).toBe(25);
    req.flush({ status: 'logged' });
  });

  it('should show reported confirmation after manual crash report', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Test error'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    component.reportCrash();

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    req.flush({ status: 'logged' });
    fixture.detectChanges();
    expect(component.reportedMessage()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Error reported');
  });

  it('should emit retry when resetError is called', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    let retried = false;
    component.retry.subscribe(() => {
      retried = true;
    });
    fixture.detectChanges();

    component.captureError(new Error('Test'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    component.resetError();
    expect(retried).toBe(true);
  });

  it('should emit reportError context on manual report', () => {
    const hostFixture = TestBed.createComponent(TestDiscoveryHostComponent);
    hostFixture.componentInstance.boundaryContext.set({
      component: 'discovery-partners',
      filterType: 'serious',
    });
    hostFixture.detectChanges();
    const component = hostFixture.debugElement.query(By.directive(DiscoveryErrorBoundaryComponent)).componentInstance;

    component.captureError(new Error('Serious filter crash'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    let reportedCtx: DiscoveryErrorContext | undefined;
    component.reportError.subscribe((ctx: DiscoveryErrorContext) => {
      reportedCtx = ctx;
    });

    component.reportCrash();
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    expect(reportedCtx).toBeDefined();
    expect(reportedCtx?.filterType).toBe('serious');
  });

  it('should increment errorCount on multiple captures', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Error 1'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    expect(component.errorCount()).toBe(1);

    component.captureError(new Error('Error 2'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    expect(component.errorCount()).toBe(2);

    expect(component.errorDetailHint()).toContain('2');
  });

  it('should reset errorCount after resetError', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Error 1'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });
    component.captureError(new Error('Error 2'));
    httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`).flush({ status: 'logged' });

    component.resetError();
    expect(component.errorCount()).toBe(0);
  });

  it('should build a structured crash payload with stack frames', () => {
    const error = new Error('Discovery grid crash');
    error.stack =
      'Error: Discovery grid crash\n    at DiscoveryComponent.searchPartners (http://localhost/discovery.component.ts:220:15)\n    at DiscoveryComponent.ngOnInit (http://localhost/discovery.component.ts:180:10)';

    const payload = DiscoveryErrorBoundaryComponent.buildCrashPayload(error, {
      component: 'discovery-grid',
      targetLanguage: 'KO',
      partnerCount: 5,
    });

    expect(payload.errorName).toBe('Error');
    expect(payload.errorMessage).toBe('Discovery grid crash');
    expect(payload.component).toBe('discovery-grid');
    expect(payload.context.targetLanguage).toBe('KO');
    expect(payload.context.partnerCount).toBe(5);
    expect(payload.stackFrames).toHaveLength(2);
    expect(payload.stackFrames?.[0].functionName).toBe('DiscoveryComponent.searchPartners');
    expect(payload.stackFrames?.[1].functionName).toBe('DiscoveryComponent.ngOnInit');
  });
});
