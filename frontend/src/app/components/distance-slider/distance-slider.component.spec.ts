import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DistanceSliderComponent } from './distance-slider.component';

describe('DistanceSliderComponent', () => {
  let component: DistanceSliderComponent;
  let fixture: ComponentFixture<DistanceSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DistanceSliderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DistanceSliderComponent);
    component = fixture.componentInstance;
  });

  async function flush(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  it('should create', async () => {
    await flush();
    expect(component).toBeDefined();
  });

  it('should render the slider input with correct initial value', async () => {
    fixture.componentRef.setInput('initialDistance', 50);
    await flush();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#distance-slider-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('50');
  });

  it('should apply initialDistance from input', async () => {
    fixture.componentRef.setInput('initialDistance', 75);
    await flush();

    expect(component['currentDistance']()).toBe(75);
  });

  it('should emit distanceChanged when the slider value changes', async () => {
    fixture.componentRef.setInput('initialDistance', 30);
    await flush();

    const emitted: number[] = [];
    component.distanceChanged.subscribe((v) => emitted.push(v));

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#distance-slider-input');
    input.value = '42';
    input.dispatchEvent(new Event('input'));
    await flush();

    expect(emitted).toContain(42);
  });

  it('should clamp values to minKm and maxKm', async () => {
    fixture.componentRef.setInput('minKm', 5);
    fixture.componentRef.setInput('maxKm', 100);
    fixture.componentRef.setInput('initialDistance', 50);
    await flush();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#distance-slider-input');

    input.value = '0';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(component['currentDistance']()).toBe(5);

    input.value = '200';
    input.dispatchEvent(new Event('input'));
    await flush();
    expect(component['currentDistance']()).toBe(100);
  });

  it('should display current distance in the label', async () => {
    fixture.componentRef.setInput('initialDistance', 33);
    await flush();

    const label = fixture.nativeElement.querySelector('label');
    expect(label.textContent).toContain('33 km');
  });

  it('should show min and max labels', async () => {
    fixture.componentRef.setInput('minKm', 1);
    fixture.componentRef.setInput('maxKm', 250);
    await flush();

    const labels = fixture.nativeElement.querySelectorAll('.text-text-muted');
    expect(labels[0].textContent).toContain('1 km');
    expect(labels[1].textContent).toContain('250 km');
  });

  it('should compute fillPercent correctly', async () => {
    fixture.componentRef.setInput('minKm', 0);
    fixture.componentRef.setInput('maxKm', 100);
    fixture.componentRef.setInput('initialDistance', 50);
    await flush();

    expect(component['fillPercent']()).toBe(50);
  });
});