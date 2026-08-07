import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TrustSafetyModalComponent } from './trust-safety-modal.component';
import { provideHttpClient } from '@angular/common/http';

describe('TrustSafetyModalComponent', () => {
  it('should create the component', () => {
    TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
      providers: [provideHttpClient()],
    });
    const fixture = TestBed.createComponent(TrustSafetyModalComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('targetId', 'user-1');
    fixture.componentRef.setInput('targetName', 'Test User');
    expect(component).toBeTruthy();
  });

  it('should default to report mode', () => {
    TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
      providers: [provideHttpClient()],
    });
    const fixture = TestBed.createComponent(TrustSafetyModalComponent);
    fixture.componentRef.setInput('targetId', 'user-1');
    fixture.componentRef.setInput('targetName', 'Test User');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.mode).toBe('report');
  });

  it('should emit close event', () => {
    TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
      providers: [provideHttpClient()],
    });
    const fixture = TestBed.createComponent(TrustSafetyModalComponent);
    fixture.componentRef.setInput('targetId', 'user-1');
    fixture.componentRef.setInput('targetName', 'Test User');
    const component = fixture.componentInstance;
    let closed = false;
    component.closed.subscribe(() => { closed = true; });
    component.closed.emit();
    expect(closed).toBe(true);
  });
});