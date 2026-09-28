import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { HlmButton } from '@spartan-ng/helm/button';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryErrorHandlerService } from '../../services/discovery-error-handler.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { DiscoveryErrorBoundaryComponent } from './discovery-error-boundary.component';

describe('DiscoveryErrorBoundaryComponent Spartan controls', () => {
  const discoveryErrorHandler = {
    reportDiscoveryCrash: vi.fn(),
  };
  const globalErrorHandler = {
    handleError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiscoveryErrorBoundaryComponent],
      providers: [
        { provide: DiscoveryErrorHandlerService, useValue: discoveryErrorHandler },
        { provide: GlobalErrorHandler, useValue: globalErrorHandler },
      ],
    });
  });

  it('delegates retry and report actions to native Spartan buttons', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    fixture.detectChanges();

    fixture.componentInstance.captureError(new Error('Discovery failed'));
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.directive(HlmButton));
    expect(buttons).toHaveLength(2);

    for (const button of buttons) {
      const element = button.nativeElement as HTMLButtonElement;
      expect(element.tagName).toBe('BUTTON');
      expect(element.type).toBe('button');
      expect(element.hasAttribute('role')).toBe(false);
      expect(element.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('keeps retry available when manual reporting is disabled', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    fixture.componentRef.setInput('showReportButton', false);
    fixture.detectChanges();

    fixture.componentInstance.captureError(new Error('Discovery failed'));
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.directive(HlmButton));
    expect(buttons).toHaveLength(1);
    expect((buttons[0].nativeElement as HTMLButtonElement).type).toBe('button');
  });

  it('preserves retry and report output contracts through the Spartan controls', () => {
    const fixture = TestBed.createComponent(DiscoveryErrorBoundaryComponent);
    const component = fixture.componentInstance;
    const retry = vi.fn();
    const report = vi.fn();
    component.retry.subscribe(retry);
    component.reportError.subscribe(report);
    fixture.detectChanges();

    component.captureError(new Error('Discovery failed'));
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.directive(HlmButton));
    (buttons[1].nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(report).toHaveBeenCalledOnce();
    expect(component.hasError()).toBe(true);

    (buttons[0].nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(retry).toHaveBeenCalledOnce();
    expect(component.hasError()).toBe(false);
  });
});
