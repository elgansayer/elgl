import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorBoundaryComponent } from './error-boundary.component';
import { EconomyErrorHandlerService } from '../../services/economy-error-handler.service';

describe('ErrorBoundaryComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ErrorBoundaryComponent],
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
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    expect(component).toBeDefined();
  });

  it('should display fallback UI when an error is handled', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.handleBoundaryError(new Error('Test rendering crash'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('errorBoundary.title');
    expect(compiled.textContent).toContain('Test rendering crash');
  });

  it('should reset error state when resetError is called', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.handleBoundaryError(new Error('Temporary error'));
    expect(component.hasError()).toBe(true);

    component.resetError();
    expect(component.hasError()).toBe(false);
    expect(component.errorSummary()).toBe('');
  });

  it('should report crash to the economy error handler', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const testError = new Error('Coin balance rendering failure');
    component.handleBoundaryError(testError);

    // The error handler should fire a POST to analytics
    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Coin balance rendering failure');
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('economy');
    expect(metadata['renderingError']).toBe(true);
    expect(metadata['boundaryContext']).toBe('economy');
    req.flush({ status: 'logged' });
  });

  it('should not show fallback when hasError is false', () => {
    const fixture = TestBed.createComponent(ErrorBoundaryComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')).toBeNull();
  });
});