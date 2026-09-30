import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    await TestBed.configureTestingModule({
      imports: [ForcedUpdateModalComponent],
    })
      .overrideComponent(ForcedUpdateModalComponent, {
        set: { imports: [MockTranslatePipe, ...HlmDialogImports] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForcedUpdateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('uses a real HTTPS update destination by default', () => {
    expect(component.storeUrl()).toBe('https://github.com/elgansayer/elgl/releases/latest');
    const anchor = document.body.querySelector(
      'a[href="https://github.com/elgansayer/elgl/releases/latest"]',
    ) as HTMLAnchorElement | null;
    expect(anchor?.getAttribute('href')).toBe('https://github.com/elgansayer/elgl/releases/latest');
  });

  it('renders a non-dismissible accessible alert dialog', () => {
    const dialog = fixture.nativeElement.querySelector(
      '[role="alertdialog"]',
    ) as HTMLElement | null;
    const content = document.body.querySelector('hlm-dialog-content') as HTMLElement | null;
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('forced-update-title');
    expect(dialog?.getAttribute('aria-describedby')).toBe('forced-update-message');
    expect(content?.textContent).toContain('forcedUpdateModal.title');
    expect(content?.textContent).toContain('forcedUpdateModal.message');
  });

  it('renders the update link with safe new-tab isolation', () => {
    const anchor = document.body.querySelector(
      'a[href="https://github.com/elgansayer/elgl/releases/latest"]',
    ) as HTMLAnchorElement | null;
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(anchor?.textContent).toContain('forcedUpdateModal.updateButton');
  });

  it('delegates focus, scroll and Escape handling to a non-dismissible Spartan dialog', () => {
    const dialog = fixture.nativeElement.querySelector('hlm-dialog') as HTMLElement | null;
    expect(dialog?.getAttribute('state')).toBe('open');
    expect(dialog?.hasAttribute('disableclose')).toBe(true);
    expect(document.body.querySelector('hlm-dialog-content')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(document.body.querySelector('hlm-dialog-content')).toBeTruthy();
  });

  it('does not cancel keyboard activation of the update link', () => {
    const anchor = document.body.querySelector(
      'a[href="https://github.com/elgansayer/elgl/releases/latest"]',
    ) as HTMLAnchorElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
