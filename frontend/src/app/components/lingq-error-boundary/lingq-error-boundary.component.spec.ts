import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import {
  LingqErrorBoundaryComponent,
  LingqErrorContext,
} from './lingq-error-boundary.component';

describe('LingqErrorBoundaryComponent', () => {
  let fixture: ComponentFixture<LingqErrorBoundaryComponent>;
  let component: LingqErrorBoundaryComponent;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();

    mockErrorHandler = {
      handleError: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [LingqErrorBoundaryComponent],
      providers: [{ provide: ErrorHandler, useValue: mockErrorHandler }],
    }).compileComponents();

    fixture = TestBed.createComponent(LingqErrorBoundaryComponent);
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

  it('should capture error and show error UI', () => {
    const testError = new Error('Tokenisation failed for Japanese text');
    component.captureError(testError, 'Intl.Segmenter tokenisation error');

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toBe('Intl.Segmenter tokenisation error');
  });

  it('should use error message when no custom message provided', () => {
    const testError = new Error('DeepL translation API timed out');
    component.captureError(testError);

    expect(component.errorMessage()).toBe('DeepL translation API timed out');
  });

  it('should report to global error handler with LingQ context', () => {
    const ctx: LingqErrorContext = {
      component: 'tokenised-text',
      operation: 'parseText',
      wordToken: 'こんにちは',
      language: 'ja',
      textLength: 42,
    };
    fixture.componentRef.setInput('context', ctx);
    fixture.detectChanges();

    const testError = new Error('Segmentation failed');
    component.captureError(testError);

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('LingqError');
    expect(reportedError.message).toContain('[LingQ:tokenised-text]');
    expect(reportedError.message).toContain('Segmentation failed');
    expect((reportedError as Record<string, unknown>).lingqContext).toEqual(ctx);
  });

  it('should reset error state and emit retry event', () => {
    const retrySpy = vi.fn();
    component.retry.subscribe(retrySpy);

    const testError = new Error('Test error');
    component.captureError(testError);
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorMessage()).toBe('');
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('should emit report event and set reported message on manual report', () => {
    const reportSpy = vi.fn();
    const ctx: LingqErrorContext = { component: 'word-definition-modal', operation: 'fetchDefinition' };
    fixture.componentRef.setInput('context', ctx);
    component.report.subscribe(reportSpy);
    fixture.detectChanges();

    const testError = new Error('Dictionary lookup failed');
    component.captureError(testError);

    mockErrorHandler.handleError.mockClear();

    component.reportCrash();

    expect(reportSpy).toHaveBeenCalledWith(ctx);
    expect(component.reportedMessage()).toBe(true);
    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const manualError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(manualError.name).toBe('LingqManualReport');
  });

  it('should render error UI when hasError is true', () => {
    const testError = new Error('Rendering error');
    component.captureError(testError, 'Unable to render reading panel');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.rounded-sheet');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Unable to render reading panel');
  });

  it('should handle unknown error objects gracefully', () => {
    const unknownErr = { custom: 'some odd shape' } as unknown as Error;
    component.captureError(unknownErr);

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toContain('Unknown error in LingQ reading engine');
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
});
