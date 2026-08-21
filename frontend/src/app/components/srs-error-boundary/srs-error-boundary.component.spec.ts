import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from './srs-error-boundary.component';

describe.skip('SrsErrorBoundaryComponent', () => {
  let fixture: ComponentFixture<SrsErrorBoundaryComponent>;
  let component: SrsErrorBoundaryComponent;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockErrorHandler = {
      handleError: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SrsErrorBoundaryComponent],
      providers: [{ provide: ErrorHandler, useValue: mockErrorHandler }],
    }).compileComponents();

    fixture = TestBed.createComponent(SrsErrorBoundaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should not show error state initially', () => {
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
  });

  it('should have role=alert on error container', () => {
    const testError = new Error('Flashcard deck failed to load');
    component.captureError(testError, 'Deck operation failed');
    fixture.detectChanges();

    const alertEl = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alertEl).toBeTruthy();
  });

  it('should capture error and show error UI', () => {
    const testError = new Error('Flashcard deck failed to load');
    component.captureError(testError, 'Deck operation failed');

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toBe('Deck operation failed');
  });

  it('should increment error count on repeated captures', () => {
    component.captureError(new Error('First error'));
    expect(component.errorCount()).toBe(1);

    component.captureError(new Error('Second error'));
    expect(component.errorCount()).toBe(2);
  });

  it('should show error detail hint when multiple errors occur', () => {
    component.captureError(new Error('First'));
    component.captureError(new Error('Second'));

    expect(component.errorDetailHint()).toContain('2');
  });

  it('should not show error detail hint for single error', () => {
    component.captureError(new Error('Only one'));
    expect(component.errorDetailHint()).toBe('');
  });

  it('should use error message when no custom message provided', () => {
    const testError = new Error('Review operation crashed');
    component.captureError(testError);

    expect(component.errorMessage()).toBe('Review operation crashed');
  });

  it('should report to global error handler with SRS context attached', () => {
    const testError = new Error('Grading failed');
    component.captureError(testError);

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('SrsError');
     
    expect((reportedError as any).srsContext.component).toBe('unknown');
    expect(reportedError.message).toContain('[SRS:unknown]');
    expect(reportedError.message).toContain('Grading failed');
  });

  it('should include extra metadata in reported errors', () => {
    const testError = new Error('Metadata test');
    component.captureError(testError, undefined, { custom: 'metadata' });

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
     
    const srsCtx = (reportedError as any).srsContext;
    expect(srsCtx.metadata.custom).toBe('metadata');
  });

  it('should reset error state and emit retry event', () => {
    const retryValues: number[] = [];
    component.retry.subscribe(() => retryValues.push(1));

    const testError = new Error('Test error');
    component.captureError(testError);
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect(component.errorCount()).toBe(0);
    expect(retryValues.length).toBe(1);
  });

  it('should emit report event and set reported message on manual report', () => {
    const reportValues: SrsErrorContext[] = [];
    component.reportError.subscribe((val) => reportValues.push(val));

    const testError = new Error('Create deck failed');
    component.captureError(testError);

    mockErrorHandler.handleError.mockClear();

    component.reportCrash();

    expect(reportValues.length).toBe(1);
    expect(reportValues[0].component).toBe('unknown');
    expect(component.reportedMessage()).toBe(true);
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const manualError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(manualError.name).toBe('SrsManualReport');
  });

  it('should render error UI when hasError is true', () => {
    const testError = new Error('Rendering error');
    component.captureError(testError, 'Custom display message');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.rounded-sheet');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Custom display message');
  });

  it('should handle unknown error objects gracefully', () => {
    const unknownErr = { custom: 'error object' } as unknown as Error;
    component.captureError(unknownErr);

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toContain('Unknown error');
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
  });

  it('should handle error without stack trace', () => {
    const error = new Error('Stackless');
    delete (error as Partial<Error>).stack;
    component.captureError(error);

    expect(component.hasError()).toBe(true);
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
  });

  it('should accept context defaults', () => {
    expect(component.context()).toEqual({ component: 'unknown' });
  });

  describe.skip('buildCrashPayload', () => {
    it('should build a structured crash payload from an error', () => {
      const ctx: SrsErrorContext = {
        component: 'vocab-dashboard',
        operation: 'gradeReview',
        deckId: 'deck-456',
      };
      const error = new Error('Test crash');
      error.name = 'SrsCrash';

      const payload = SrsErrorBoundaryComponent.buildCrashPayload(error, ctx);

      expect(payload.errorName).toBe('SrsCrash');
      expect(payload.errorMessage).toBe('Test crash');
      expect(payload.component).toBe('vocab-dashboard');
      expect(payload.operation).toBe('gradeReview');
      expect(payload.context).toEqual(ctx);
      expect(payload.timestamp).toBeTruthy();
      expect(payload.url).toBeTruthy();
      expect(payload.userAgent).toBeTruthy();
    });

    it('should use defaults when error name and message are empty', () => {
      const error = new Error();
      error.message = '';
      error.name = '';
      const ctx: SrsErrorContext = { component: 'test' };

      const payload = SrsErrorBoundaryComponent.buildCrashPayload(error, ctx);

      expect(payload.errorName).toBe('UnknownError');
      expect(payload.errorMessage).toBe('No message');
    });

    it('should parse stack frames from stack trace', () => {
      const ctx: SrsErrorContext = { component: 'test' };
      const error = new Error('Test');
      error.stack = 'Error: Test\n    at testFunction (http://localhost:4200/main.js:42:10)\n    at <anonymous>';

      const payload = SrsErrorBoundaryComponent.buildCrashPayload(error, ctx);

      expect(payload.stackFrames).toBeDefined();
      expect(payload.stackFrames?.length).toBeGreaterThanOrEqual(1);
    });
  });
});