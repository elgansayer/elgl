import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
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
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForcedUpdateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a default storeUrl', () => {
    expect(component.storeUrl()).toBe('https://yourapp.com/update');
  });

  it('should render the update link', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const anchor = compiled.querySelector('a');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('target')).toBe('_blank');
  });

  it('should render link with default storeUrl', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const anchor = compiled.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://yourapp.com/update');
  });

  it('should render title text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('forcedUpdateModal.title');
  });

  it('should render message text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('forcedUpdateModal.message');
  });

  it('should render update button text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('forcedUpdateModal.updateButton');
  });

  it('should block click events', () => {
    const event = new Event('click');
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.onDocumentClick(event);
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should block scroll events', () => {
    const event = new Event('scroll');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.preventScroll(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should block events inside the modal wrapper', () => {
    const event = new Event('touchmove');
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.blockEvent(event);
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should lock body scroll on init', () => {
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll on destroy', () => {
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('should block Escape key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.onKeydown(event);
    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should block Esc key alias', () => {
    const event = new KeyboardEvent('keydown', { key: 'Esc' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.onKeydown(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should block other keyboard keys', () => {
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.onKeydown(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});