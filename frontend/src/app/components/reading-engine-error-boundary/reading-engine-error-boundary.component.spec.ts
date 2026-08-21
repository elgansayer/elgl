import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  ReadingEngineErrorBoundaryComponent,
  ReadingEngineErrorContext,
} from './reading-engine-error-boundary.component';
import { ReadingEngineCrashReportingService } from '../../services/reading-engine-crash-reporting.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

class I18nStub {
  translate(key: string): string {
    return key;
  }
}

describe('ReadingEngineErrorBoundaryComponent', () => {
  let component: ReadingEngineErrorBoundaryComponent;
  let fixture: ComponentFixture<ReadingEngineErrorBoundaryComponent>;
  let crashReportingService: ReadingEngineCrashReportingService;

  beforeEach(async () => {
    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
    };

    await TestBed.configureTestingModule({
      imports: [ReadingEngineErrorBoundaryComponent, HttpClientTestingModule],
      providers: [
        ReadingEngineCrashReportingService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: I18nService, useClass: I18nStub },
        { provide: GlobalErrorHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingEngineErrorBoundaryComponent);
    component = fixture.componentInstance;
    crashReportingService = TestBed.inject(ReadingEngineCrashReportingService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with no error', () => {
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect(component.reportedMessage()).toBe(false);
    expect(component.errorCount()).toBe(0);
  });

  it('should capture an error and show error UI', () => {
    const testError = new Error('Test reading engine crash');
    component.captureError(testError, 'User-friendly message');

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toBe('User-friendly message');
    expect(component.errorCount()).toBe(1);
  });

  it('should increment error count on repeated captures', () => {
    component.captureError(new Error('First error'));
    component.captureError(new Error('Second error'));

    expect(component.errorCount()).toBe(2);
  });

  it('should reset error state and emit retry', () => {
    let retryEmitted = false;
    component.retry.subscribe(() => {
      retryEmitted = true;
    });
    component.captureError(new Error('temp error'));
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect(component.errorCount()).toBe(0);
    expect(retryEmitted).toBe(true);
  });

  it('should report crash manually and emit reportError', () => {
    let reportEmitted = false;
    let emittedContext: ReadingEngineErrorContext | undefined;
    component.reportError.subscribe((ctx) => {
      reportEmitted = true;
      emittedContext = ctx;
    });

    component.captureError(new Error('Crash'));
    component.reportCrash();

    expect(component.reportedMessage()).toBe(true);
    expect(reportEmitted).toBe(true);
    expect(emittedContext).toBeDefined();
  });

  it('should report crash via crashReportingService on captureError', () => {
    const spy = vi.spyOn(crashReportingService, 'reportCrash');

    const testError = new Error('Reporting test');
    testError.stack =
      'Error: Reporting test\n    at Object.<anonymous> (/app/test.ts:42:10)\n    at Test.run (/app/runner.ts:100:5)';
    component.captureError(testError, 'Captured error');

    expect(spy).toHaveBeenCalledTimes(1);
    const callArgs = spy.mock.calls[0][0];
    expect(callArgs.message).toBe('[ReadingEngine:unknown] Captured error');
  });

  it('should use error message as fallback when no custom message', () => {
    const testError = new Error('Fallback message');
    component.captureError(testError);

    expect(component.errorMessage()).toBe('Fallback message');
  });

  it('should show error detail hint with repeated errors', () => {
    component.captureError(new Error('Err 1'));
    component.captureError(new Error('Err 2'));

    const hint = component.errorDetailHint();
    expect(hint).toContain('Error count: 2');
  });

  it('should not show error detail hint for single error', () => {
    component.captureError(new Error('Single'));
    expect(component.errorDetailHint()).toBe('');
  });

  it('should build crash payload with correct structure', () => {
    const error = new Error('Payload test');
    error.stack = 'Error: Payload test\n    at Object.<anonymous> (/app/main.ts:1:2)';
    const context: ReadingEngineErrorContext = {
      component: 'test-comp',
      operation: 'tokenise',
      articleLanguage: 'en-GB',
      activeArticleId: 'article-1',
    };

    const payload = ReadingEngineErrorBoundaryComponent.buildCrashPayload(error, context);

    expect(payload.errorName).toBe('Error');
    expect(payload.errorMessage).toBe('Payload test');
    expect(payload.component).toBe('test-comp');
    expect(payload.operation).toBe('tokenise');
    expect(payload.context.articleLanguage).toBe('en-GB');
    expect(payload.context.activeArticleId).toBe('article-1');
    expect(payload.timestamp).toBeTruthy();
    expect(payload.url).toBeTruthy();
    expect(payload.userAgent).toBeTruthy();
  });

  it('should handle default context values', () => {
    const component2 = TestBed.createComponent(ReadingEngineErrorBoundaryComponent)
      .componentInstance;
    expect(component2.context()).toEqual({ component: 'unknown' });
    expect(component2.showReportButton()).toBe(true);
  });

  it('should handle captureError with extra metadata', () => {
    const spy = vi.spyOn(crashReportingService, 'reportCrash');
    component.captureError(new Error('Extra metadata test'), undefined, {
      extraField: 'value',
      count: 42,
    });

    expect(component.hasError()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
