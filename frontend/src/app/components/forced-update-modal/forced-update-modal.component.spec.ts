import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForcedUpdateModalComponent } from './forced-update-modal.component';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('ForcedUpdateModalComponent', () => {
  let component: ForcedUpdateModalComponent;
  let fixture: ComponentFixture<ForcedUpdateModalComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    document.body.style.overflow = '';

    await TestBed.configureTestingModule({
      imports: [ForcedUpdateModalComponent],
    })
      .overrideComponent(ForcedUpdateModalComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForcedUpdateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    document.body.style.overflow = '';
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('uses a real HTTPS update destination by default', () => {
    expect(component.storeUrl()).toBe('https://github.com/elgansayer/elgl/releases/latest');
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement | null;
    expect(anchor?.getAttribute('href')).toBe('https://github.com/elgansayer/elgl/releases/latest');
  });

  it('renders a non-dismissible accessible alert dialog', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const dialog = compiled.querySelector('[role="alertdialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('forced-update-title');
    expect(dialog?.getAttribute('aria-describedby')).toBe('forced-update-message');
    expect(compiled.textContent).toContain('forcedUpdateModal.title');
    expect(compiled.textContent).toContain('forcedUpdateModal.message');
  });

  it('renders the update link with safe new-tab isolation', () => {
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement | null;
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.textContent).toContain('forcedUpdateModal.updateButton');
  });

  it('locks body scrolling while mounted and restores the previous value', () => {
    fixture.destroy();
    document.body.style.overflow = 'clip';

    fixture = TestBed.createComponent(ForcedUpdateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.destroy();
    expect(document.body.style.overflow).toBe('clip');
  });

  it('prevents Escape from dismissing the gate', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    component.blockEscape(event);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not cancel keyboard activation of the update link', () => {
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
