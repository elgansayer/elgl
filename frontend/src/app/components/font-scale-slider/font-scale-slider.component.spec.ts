import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { vi, type Mock } from 'vitest';
import { FontScaleSliderComponent } from './font-scale-slider.component';
import { FontScaleService } from '../../services/font-scale.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

// A minimal stub pipe so we do not depend on the real I18nService translation dictionary
@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

describe('FontScaleSliderComponent', () => {
  let component: FontScaleSliderComponent;
  let fixture: ComponentFixture<FontScaleSliderComponent>;

  let scaleFactor: ReturnType<typeof signal<number>>;
  let setScaleSpy: Mock;

  beforeEach(async () => {
    scaleFactor = signal<number>(1.0);
    setScaleSpy = vi.fn((factor: number) => {
      scaleFactor.set(factor);
    });

    const fontScaleService: Partial<FontScaleService> = {
      scaleFactor,
      min: 0.8,
      max: 1.5,
      step: 0.05,
      setScale: setScaleSpy,
    };

    const i18nService: Partial<I18nService> = {
      currentLang: signal<string>('en-GB'),
    };

    await TestBed.configureTestingModule({
      imports: [FontScaleSliderComponent],
      providers: [
        { provide: FontScaleService, useValue: fontScaleService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(FontScaleSliderComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FontScaleSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the documented 80-150 percent range', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');

    expect(input).toBeTruthy();
    expect(input.min).toBe('0.8');
    expect(input.max).toBe('1.5');
    expect(input.step).toBe('0.05');
    expect(input.getAttribute('aria-valuemin')).toBe('0.8');
    expect(input.getAttribute('aria-valuemax')).toBe('1.5');
  });

  it('should render a range input reflecting the current scale factor', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('1');
  });

  it('should call setScale with 150 percent when the slider reaches its maximum', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
    input.value = '1.5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(setScaleSpy).toHaveBeenCalledWith(1.5);
    expect(input.getAttribute('aria-valuenow')).toBe('1.5');
    expect(input.getAttribute('aria-valuetext')).toBe('150%');
  });

  it('should display the scale factor as a percentage label', () => {
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toBe('100%');
  });

  it('should update the percentage label when the scale factor changes', () => {
    scaleFactor.set(1.3);
    fixture.detectChanges();

    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.textContent?.trim()).toBe('130%');
  });

  it('should associate the label with the slider via a for/id pair for accessibility', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
    expect(label.htmlFor).toBe(input.id);
  });
});
