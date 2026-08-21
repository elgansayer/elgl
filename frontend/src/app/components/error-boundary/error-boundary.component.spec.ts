import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HlmButton } from '@spartan-ng/helm/button';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EconomyErrorHandlerService } from '../../services/economy-error-handler.service';
import { ErrorBoundaryComponent } from './error-boundary.component';

describe('ErrorBoundaryComponent', () => {
  const reportEconomyCrash = vi.fn();

  beforeEach(() => {
    reportEconomyCrash.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ErrorBoundaryComponent],
      providers: [
        {
          provide: EconomyErrorHandlerService,
          useValue: { reportEconomyCrash },
        },
      ],
    });
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    expect(fixture.componentInstance).toBeDefined();
  });

  it('should display fallback UI and automatically report when an error is handled', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    const error = new Error('Test rendering crash');

    component.handleBoundaryError(error);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('errorBoundary.title');
    expect(compiled.textContent).toContain('Test rendering crash');
    expect(reportEconomyCrash).toHaveBeenCalledTimes(1);
    expect(reportEconomyCrash).toHaveBeenCalledWith(error, {
      boundaryContext: 'economy',
      renderingError: true,
    });
  });

  it('should keep both fallback actions on native Spartan buttons', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    fixture.componentInstance.handleBoundaryError(new Error('Test crash'));
    fixture.detectChanges();

    const spartanButtons = fixture.debugElement.queryAll(By.directive(HlmButton));
    const nativeButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    expect(spartanButtons).toHaveLength(2);
    expect(nativeButtons).toHaveLength(2);
    for (const button of nativeButtons) {
      expect(button.type).toBe('button');
      expect(button.getAttribute('role')).toBeNull();
      expect(button.getAttribute('tabindex')).toBeNull();
    }
  });

  it('should hide only Retry when showRetry is false', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    fixture.componentRef.setInput('showRetry', false);
    fixture.componentInstance.handleBoundaryError(new Error('Test crash'));
    fixture.detectChanges();

    const spartanButtons = fixture.debugElement.queryAll(By.directive(HlmButton));
    const nativeButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    expect(spartanButtons).toHaveLength(1);
    expect(nativeButtons).toHaveLength(1);
    expect(nativeButtons[0].textContent).toContain('errorBoundary.report');
  });

  it('should reset error state through the native Retry action', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    component.handleBoundaryError(new Error('Temporary error'));
    fixture.detectChanges();

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const retry = buttons.find((button) => button.textContent?.includes('errorBoundary.retry'));
    expect(retry).toBeDefined();

    retry?.click();
    fixture.detectChanges();

    expect(component.hasError()).toBe(false);
    expect(component.errorSummary()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('h2')).toBeNull();
  });

  it('should preserve the manual Report interaction contract', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    const error = new Error('Coin balance rendering failure');
    fixture.componentRef.setInput('context', 'wallet-panel');

    component.handleBoundaryError(error);
    fixture.detectChanges();

    const report = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('errorBoundary.report'));
    expect(report).toBeDefined();

    report?.click();

    expect(reportEconomyCrash).toHaveBeenCalledTimes(2);
    expect(reportEconomyCrash).toHaveBeenNthCalledWith(1, error, {
      boundaryContext: 'wallet-panel',
      renderingError: true,
    });
    expect(reportEconomyCrash).toHaveBeenNthCalledWith(2, error, {
      boundaryContext: 'wallet-panel',
    });
  });

  it('should not manually report after the error is reset', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;

    component.handleBoundaryError(new Error('Temporary error'));
    component.resetError();
    component.reportCrash();

    expect(reportEconomyCrash).toHaveBeenCalledTimes(1);
  });

  it('should not show fallback when hasError is false', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('h2')).toBeNull();
    expect(fixture.debugElement.queryAll(By.directive(HlmButton))).toHaveLength(0);
  });
});
