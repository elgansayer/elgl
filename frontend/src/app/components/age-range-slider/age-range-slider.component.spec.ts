import { describe, beforeEach, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { AgeRangeSliderComponent, AgeRange } from './age-range-slider.component';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('AgeRangeSliderComponent', () => {
  let component: AgeRangeSliderComponent;
  let fixture: ComponentFixture<AgeRangeSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgeRangeSliderComponent],
    })
      .overrideComponent(AgeRangeSliderComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AgeRangeSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders default limits and initial values', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const minInput = compiled.querySelector('#age-range-min') as HTMLInputElement;
    const maxInput = compiled.querySelector('#age-range-max') as HTMLInputElement;

    expect(minInput).toBeTruthy();
    expect(maxInput).toBeTruthy();
    expect(minInput.value).toBe('18');
    expect(maxInput.value).toBe('100');
    expect(minInput.getAttribute('min')).toBe('18');
    expect(minInput.getAttribute('max')).toBe('100');
  });

  it('uses Relay semantic tokens and RTL logical properties in template', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const label = compiled.querySelector('#age-range-label');
    expect(label?.classList.contains('text-text-secondary')).toBe(true);
    expect(label?.classList.contains('text-on-surface-variant')).toBe(false);

    const track = compiled.querySelector('.relative .absolute.bottom-1');
    expect(track?.classList.contains('bg-surface-200')).toBe(true);
    expect(track?.classList.contains('bg-surface-container')).toBe(false);

    const fill = track?.querySelector('div');
    expect(fill?.classList.contains('bg-primary')).toBe(true);
    // Inset-inline-start should be present on fill style, not physical left
    const styleAttr = fill?.getAttribute('style') || '';
    expect(styleAttr).toContain('inset-inline-start');
    expect(styleAttr).not.toContain('left:');
  });

  it('does not reference non-Relay token --color-surface in component styles', () => {
    const styles = (
      AgeRangeSliderComponent as unknown as { ɵcmp: { styles: string[] } }
    ).ɵcmp.styles
      .join('\n')
      .replaceAll('%NS%', '');

    expect(styles).not.toContain('--color-surface');
    expect(styles).toContain('--color-primary-rgb');
    expect(styles).toContain('--surface-500-rgb');
  });

  it('clamps and emits ageRangeChanged when min slider changes', () => {
    const emitted: AgeRange[] = [];
    component.ageRangeChanged.subscribe((val) => emitted.push(val));

    const compiled = fixture.nativeElement as HTMLElement;
    const minInput = compiled.querySelector('#age-range-min') as HTMLInputElement;

    minInput.value = '25';
    minInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ min: 25, max: 100 });
    expect(minInput.getAttribute('aria-valuenow')).toBe('25');
  });

  it('clamps and emits ageRangeChanged when max slider changes', () => {
    const emitted: AgeRange[] = [];
    component.ageRangeChanged.subscribe((val) => emitted.push(val));

    const compiled = fixture.nativeElement as HTMLElement;
    const maxInput = compiled.querySelector('#age-range-max') as HTMLInputElement;

    maxInput.value = '45';
    maxInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ min: 18, max: 45 });
    expect(maxInput.getAttribute('aria-valuenow')).toBe('45');
  });

  it('prevents min from exceeding maxAge', () => {
    const emitted: AgeRange[] = [];
    component.ageRangeChanged.subscribe((val) => emitted.push(val));

    const compiled = fixture.nativeElement as HTMLElement;
    const maxInput = compiled.querySelector('#age-range-max') as HTMLInputElement;
    const minInput = compiled.querySelector('#age-range-min') as HTMLInputElement;

    maxInput.value = '40';
    maxInput.dispatchEvent(new Event('input'));

    minInput.value = '50';
    minInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const last = emitted.at(-1);
    expect(last?.min).toBe(40);
  });
});
