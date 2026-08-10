import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReadingEngineErrorBoundaryComponent } from './reading-engine-error-boundary.component';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

/**
 * I18n stub that returns the translation key as-is, so tests can assert
 * against keys rather than resolved English strings.
 */
class I18nStub {
  readonly currentLang = signal('en-GB');
  readonly direction = signal('ltr');
  readonly availableLanguages: Array<Record<string, unknown>> = [];
  translate(key: string): string {
    return key;
  }
}

@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [ReadingEngineErrorBoundaryComponent],
  template: `
    <app-reading-engine-error-boundary>
      <div class="child-content">Healthy child content</div>
    </app-reading-engine-error-boundary>
  `,
})
class TestHostComponent {}

describe('ReadingEngineErrorBoundaryComponent', () => {
  let httpTesting: HttpTestingController;

  /** Matcher for client-error POST requests regardless of base URL */
  function matchesClientError(req: { url: string; method: string }): boolean {
    return req.url.includes('/analytics/client-error') && req.method === 'POST';
  }

  /** Flush all pending client-error requests */
  function flushAll(): void {
    const requests = httpTesting.match(matchesClientError);
    requests.forEach((req) => req.flush({ status: 'logged' }));
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    const mockAuthService = {
      getAccessToken: () => 'test-token',
      isAuthenticated: signal(true),
    };

    TestBed.configureTestingModule({
      imports: [ReadingEngineErrorBoundaryComponent, TestHostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useClass: I18nStub },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    flushAll();
    httpTesting.verify();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    expect(component).toBeDefined();
  });

  it('should display child content when no error', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.child-content')).toBeDefined();
    expect(compiled.textContent).toContain('Healthy child content');
  });

  it('should display fallback UI when an error is handled', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Article rendering crash'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')?.textContent).toContain(
      'readingEngine.errorBoundary.title',
    );
    expect(compiled.textContent).toContain('Article rendering crash');
  });

  it('should reset error state when resetError is called', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Temporary error'));
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorSummary()).toBe('');
  });

  it('should report crash to the error handler service', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const testError = new Error('Reading engine tokenisation failure');
    component.captureError(testError);

    // captureError should fire a POST to analytics
    const req = httpTesting.expectOne(matchesClientError);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Reading engine tokenisation failure');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('reading-engine');
    expect(metadata['renderingError']).toBe(true);
    req.flush({ status: 'logged' });
  });

  it('should increment error count on repeated errors', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Error 1'));
    expect(component.errorCount()).toBe(1);

    component.captureError(new Error('Error 2'));
    expect(component.errorCount()).toBe(2);

    component.resetError();
    expect(component.errorCount()).toBe(0);
  });

  it('should show reported message on manual crash report', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.captureError(new Error('Test error'));
    fixture.detectChanges();

    component.reportCrash();
    fixture.detectChanges();

    expect(component.reportedMessage()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('readingEngine.errorBoundary.reportedMessage');

    // captureError fires one request, reportCrash fires another
    const requests = httpTesting.match(matchesClientError);
    expect(requests.length).toBe(2);
    requests.forEach((req) => req.flush({ status: 'logged' }));
  });

  it('should not show fallback when hasError is false', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')).toBeNull();
  });

  it('should emit retry event on resetError', () => {
    const fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    let retryEmitted = false;
    component.retry.subscribe(() => {
      retryEmitted = true;
    });

    component.captureError(new Error('Test'));
    fixture.detectChanges();
    component.resetError();
    expect(retryEmitted).toBe(true);
  });
});
