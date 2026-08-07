import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import {
  SrsErrorBoundaryComponent,
  SrsErrorContext,
} from './srs-error-boundary.component';

describe('SrsErrorBoundaryComponent', () => {
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

  it('should capture error and show error UI', () => {
    const testError = new Error('Flashcard deck failed to load');
    component.captureError(testError, 'Deck operation failed');

    expect(component.hasError()).toBe(true);
    expect(component.errorMessage()).toBe('Deck operation failed');
  });

  it('should use error message when no custom message provided', () => {
    const testError = new Error('Review operation crashed');
    component.captureError(testError);

    expect(component.errorMessage()).toBe('Review operation crashed');
  });

  it('should report to global error handler with SRS context', () => {
    const ctx: SrsErrorContext = {
      component: 'flashcard-review',
      operation: 'gradeReview',
      deckId: 'deck-123',
      cardCount: 10,
      currentIndex: 3,
      srsLevel: 2,
    };
    fixture.componentRef.setInput('context', ctx);
    fixture.detectChanges();

    const testError = new Error('Grading failed');
    component.captureError(testError);

    expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
    const reportedError = mockErrorHandler.handleError.mock.calls[0][0] as Error;
    expect(reportedError.name).toBe('SrsError');
    expect(reportedError.message).toContain('[SRS:flashcard-review]');
    expect(reportedError.message).toContain('Grading failed');
    expect((reportedError as Error & { srsContext?: SrsErrorContext }).srsContext).toEqual(ctx);
  });

  it('should reset error state and emit retry event', () => {
    const retrySpy = vi.fn();
    fixture.componentRef.setInput('retry', retrySpy);

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
    const ctx: SrsErrorContext = { component: 'flashcard-deck', operation: 'createDeck' };
    fixture.componentRef.setInput('context', ctx);
    fixture.componentRef.setInput('report', reportSpy);
    fixture.detectChanges();

    const testError = new Error('Create deck failed');
    component.captureError(testError);

    mockErrorHandler.handleError.mockClear();

    component.reportCrash();

    expect(reportSpy).toHaveBeenCalledWith(ctx);
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
});