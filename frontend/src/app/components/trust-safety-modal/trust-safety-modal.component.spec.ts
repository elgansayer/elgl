import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrustSafetyModalComponent } from './trust-safety-modal.component';

describe('TrustSafetyModalComponent', () => {
  let fixture: ComponentFixture<TrustSafetyModalComponent>;
  let component: TrustSafetyModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrustSafetyModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrustSafetyModalComponent);
    fixture.componentRef.setInput('targetId', 'user-123');
    fixture.componentRef.setInput('targetName', 'TestUser');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the dialog with correct ARIA attributes', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(component.titleId);
    expect(dialog.getAttribute('aria-describedby')).toBe(component.descriptionId);
  });

  it('renders the title with safety.title key', () => {
    const title = fixture.nativeElement.querySelector(`#${component.titleId}`);
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('safety.title');
  });

  it('renders the description with target name', () => {
    const desc = fixture.nativeElement.querySelector(`#${component.descriptionId}`);
    expect(desc).toBeTruthy();
    expect(desc.textContent).toContain('TestUser');
  });

  it('has tablist for mode selection with correct aria-label', () => {
    const tablist = fixture.nativeElement.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    expect(tablist.getAttribute('aria-label')).toContain('safety.modeLabel');
  });

  it('renders two tabs with correct aria attributes', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('switches mode and updates aria-selected on tab press', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    (tabs[1] as HTMLElement).click();
    fixture.detectChanges();

    const updated = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(updated[0].getAttribute('aria-selected')).toBe('false');
    expect(updated[1].getAttribute('aria-selected')).toBe('true');
    expect(component.mode()).toBe('block');
  });

  it('shows report form when mode is report', () => {
    component.setMode('report');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('#safety-report-reason');
    expect(select).toBeTruthy();
    const textarea = fixture.nativeElement.querySelector('#safety-report-details');
    expect(textarea).toBeTruthy();
  });

  it('shows block warning with role="alert" when mode is block', () => {
    component.setMode('block');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('TestUser');
  });

  it('close button has aria-label', () => {
    const closeBtn = fixture.nativeElement.querySelector('[aria-label]') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('aria-label')).toContain('safety.closeBtn');
  });

  it('emits closed when the dialog backdrop is clicked', () => {
    const emitSpy = vi.spyOn(component.closed, 'emit');
    const overlay = fixture.nativeElement.querySelector('.bg-black\\/60') as HTMLElement;
    expect(overlay).toBeTruthy();
    overlay.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});