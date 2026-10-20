import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DistanceSliderComponent } from './distance-slider.component';

describe.skip('DistanceSliderComponent', () => {
  let component: DistanceSliderComponent;
  let fixture: ComponentFixture<DistanceSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistanceSliderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DistanceSliderComponent);
    component = fixture.componentInstance;

    // Set required inputs before first change detection
    fixture.componentRef.setInput('minKm', 1);
    fixture.componentRef.setInput('maxKm', 200);
    fixture.componentRef.setInput('initialDistanceKm', 50);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeDefined();
  });

  it('should initialise with the provided initial distance', () => {
    fixture.componentRef.setInput('initialDistanceKm', 120);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(120);
  });

  it('should default to 50km when no initial distance is provided', () => {
    fixture.componentRef.setInput('initialDistanceKm', undefined);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(50);
  });

  it('should emit distanceChanged when the slider value changes', () => {
    const spy = vi.fn();
    component.distanceChanged.subscribe(spy);

    fixture.componentRef.setInput('initialDistanceKm', 30);
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(30);
  });

  it('should clamp the value within valid range', () => {
    const slider = fixture.nativeElement.querySelector('input[type="range"]');
    fixture.detectChanges();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;

    nativeInputValueSetter.call(slider, '999');
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(200);
  });

  it('should clamp below minimum', () => {
    fixture.detectChanges();
    const slider = fixture.nativeElement.querySelector('input[type="range"]');

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;

    nativeInputValueSetter.call(slider, '-10');
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(1);
  });

  it('should disable the slider when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('input[type="range"]');
    expect(slider.disabled).toBe(true);
  });

  it('should enable the slider when disabled input is false', () => {
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('input[type="range"]');
    expect(slider.disabled).toBe(false);
  });

  it('should render a label with translated text', () => {
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('label');
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('50');
  });

  it('keeps the translated label and native control fluid at the mobile baseline', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    const labelText: HTMLSpanElement = label.querySelector('span')!;
    const controlHitArea: HTMLSpanElement = label.querySelector('span.relative')!;
    const input = slider();

    expect(label.classList.contains('min-w-0')).toBe(true);
    expect(labelText.classList.contains('break-words')).toBe(true);
    expect(labelText.classList.contains('whitespace-nowrap')).toBe(false);
    expect(controlHitArea.classList.contains('min-h-11')).toBe(true);
    expect(input.classList.contains('h-11')).toBe(true);
    expect(input.classList.contains('w-full')).toBe(true);
  });

  it('uses only Relay semantic colour tokens for the track and thumb', () => {
    const styles = (
      DistanceSliderComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp.styles.join('\n');

    expect(styles).toContain('rgb(var(--surface-100-rgb))');
    expect(styles).toContain('rgb(var(--surface-500-rgb))');
    expect(styles).toContain('rgb(var(--color-primary-rgb))');
    expect(styles).not.toContain('--color-surface');
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
