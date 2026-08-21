import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { DistanceSliderComponent } from './distance-slider.component';

class MockI18nService {
  translate(key: string, params?: Record<string, unknown>): string {
    if (key === 'discovery.radiusLabel') {
      return `Radius ${String(params?.['radius'] ?? '')} km`;
    }
    return key;
  }
}

describe('DistanceSliderComponent', () => {
  let component: DistanceSliderComponent;
  let fixture: ComponentFixture<DistanceSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistanceSliderComponent],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DistanceSliderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('minKm', 1);
    fixture.componentRef.setInput('maxKm', 200);
    fixture.componentRef.setInput('initialDistanceKm', 50);
  });

  function slider(): HTMLInputElement {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('input[type="range"]');
  }

  function setSliderValue(value: string): void {
    const input = slider();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    if (!nativeInputValueSetter) throw new Error('Native input value setter unavailable');
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('uses the native range control as the interaction primitive', () => {
    const input = slider();

    expect(input.type).toBe('range');
    expect(input.min).toBe('1');
    expect(input.max).toBe('200');
    expect(input.step).toBe('1');
    expect(input.tabIndex).toBe(0);
    expect(input.hasAttribute('role')).toBe(false);
    expect(input.hasAttribute('tabindex')).toBe(false);
    expect(input.hasAttribute('aria-valuetext')).toBe(false);
  });

  it('renders the parent-provided initial value without emitting a user change', () => {
    const changed = vi.fn();
    component.distanceChanged.subscribe(changed);

    fixture.componentRef.setInput('initialDistanceKm', 120);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(120);
    expect(slider().value).toBe('120');
    expect(changed).not.toHaveBeenCalled();
  });

  it('defaults to 50km when no initial distance is provided', () => {
    fixture.componentRef.setInput('initialDistanceKm', undefined);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(50);
    expect(slider().value).toBe('50');
  });

  it('emits only for user-driven input', () => {
    const changed = vi.fn();
    component.distanceChanged.subscribe(changed);

    setSliderValue('30');

    expect(component.currentDistanceKm()).toBe(30);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(30);
  });

  it('clamps user-driven values to the configured range', () => {
    const changed = vi.fn();
    component.distanceChanged.subscribe(changed);

    setSliderValue('999');
    expect(component.currentDistanceKm()).toBe(200);
    expect(changed).toHaveBeenLastCalledWith(200);

    setSliderValue('-10');
    expect(component.currentDistanceKm()).toBe(1);
    expect(changed).toHaveBeenLastCalledWith(1);
  });

  it('clamps parent-provided values without synthesising an output event', () => {
    const changed = vi.fn();
    component.distanceChanged.subscribe(changed);

    fixture.componentRef.setInput('initialDistanceKm', 999);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(200);
    expect(slider().value).toBe('200');
    expect(changed).not.toHaveBeenCalled();
  });

  it('keeps current state valid when bounds change', () => {
    const changed = vi.fn();
    component.distanceChanged.subscribe(changed);

    fixture.componentRef.setInput('maxKm', 40);
    fixture.detectChanges();

    expect(component.currentDistanceKm()).toBe(40);
    expect(slider().max).toBe('40');
    expect(slider().value).toBe('40');
    expect(changed).not.toHaveBeenCalled();
  });

  it('normalises reversed bounds for the native control', () => {
    fixture.componentRef.setInput('minKm', 200);
    fixture.componentRef.setInput('maxKm', 1);
    fixture.detectChanges();

    expect(slider().min).toBe('1');
    expect(slider().max).toBe('200');
    expect(component.currentDistanceKm()).toBe(50);
  });

  it('uses the native disabled state', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(slider().disabled).toBe(true);
  });

  it('associates the translated visible label without a duplicate-prone fixed id', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    const input = slider();

    expect(label).toBeTruthy();
    expect(label.textContent).toContain('Radius 50 km');
    expect(label.contains(input)).toBe(true);
    expect(input.id).toBe('');
  });
});
