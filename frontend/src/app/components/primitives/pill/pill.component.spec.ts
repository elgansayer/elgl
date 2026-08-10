import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppPillComponent } from './pill.component';
import { I18nService } from '../../../services/i18n.service';

const colourClassMap: Record<string, string> = {
  'pill.colour_primary': 'bg-primary/10 text-primary',
  'pill.colour_success': 'bg-emerald-500/20 text-emerald-400',
  'pill.colour_warning': 'bg-yellow-500/20 text-yellow-400',
  'pill.colour_danger': 'bg-red-500/20 text-red-400',
  'pill.colour_info': 'bg-sky-500/20 text-sky-400',
  'pill.colour_neutral': 'bg-slate-500/20 text-slate-400',
};

class MockI18nService {
  translate(key: string): string {
    return colourClassMap[key] ?? '';
  }
}

@Component({
  template: `
    <app-pill [label]="label()" [colour]="colour()" [size]="size()" [customClass]="customClass()">
      Projected Pill
    </app-pill>
  `,
  imports: [AppPillComponent],
})
class TestHostComponent {
  label = signal('');
  colour = signal<'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'>('success');
  size = signal<'sm' | 'md'>('md');
  customClass = signal('');
}

describe('AppPillComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let pillHostElement: HTMLElement;
  let pillElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppPillComponent],
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    pillHostElement = fixture.nativeElement.querySelector('app-pill') as HTMLElement;
    pillElement = fixture.nativeElement.querySelector('app-pill span') as HTMLElement;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render label when provided', () => {
    host.label.set('Active Status');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Active Status');
  });

  it('should render projected content when label signal is empty', () => {
    host.label.set('');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Projected Pill');
  });

  it('should not render projected content when label is set', () => {
    host.label.set('Active Status');
    fixture.detectChanges();
    expect(pillElement.textContent?.trim()).toBe('Active Status');
    expect(pillElement.textContent?.includes('Projected Pill')).toBe(false);
  });

  it('should apply host inline-block class', () => {
    expect(pillHostElement.classList.contains('inline-block')).toBe(true);
  });

  it('should apply base pill classes', () => {
    expect(pillElement.classList.contains('inline-flex')).toBe(true);
    expect(pillElement.classList.contains('items-center')).toBe(true);
    expect(pillElement.classList.contains('justify-center')).toBe(true);
    expect(pillElement.classList.contains('font-extrabold')).toBe(true);
    expect(pillElement.classList.contains('rounded-full')).toBe(true);
  });

  it('should apply success colour and md logical size classes', () => {
    host.colour.set('success');
    host.size.set('md');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-emerald-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-emerald-400')).toBe(true);
    expect(pillElement.classList.contains('ps-3')).toBe(true);
    expect(pillElement.classList.contains('pe-3')).toBe(true);
    expect(pillElement.classList.contains('py-1')).toBe(true);
    expect(pillElement.classList.contains('text-sm')).toBe(true);
  });

  it('should update classes when colour is changed to primary and size to sm', () => {
    host.colour.set('primary');
    host.size.set('sm');
    host.customClass.set('pill-custom');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-primary/10')).toBe(true);
    expect(pillElement.classList.contains('text-primary')).toBe(true);
    expect(pillElement.classList.contains('ps-2')).toBe(true);
    expect(pillElement.classList.contains('pe-2')).toBe(true);
    expect(pillElement.classList.contains('py-0.5')).toBe(true);
    expect(pillElement.classList.contains('text-xs')).toBe(true);
    expect(pillElement.classList.contains('pill-custom')).toBe(true);
  });

  it('should apply warning colour classes', () => {
    host.colour.set('warning');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-yellow-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-yellow-400')).toBe(true);
  });

  it('should apply danger colour classes', () => {
    host.colour.set('danger');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-red-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-red-400')).toBe(true);
  });

  it('should apply info colour classes', () => {
    host.colour.set('info');
    fixture.detectChanges();
    expect(pillElement.classList.contains('bg-sky-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-sky-400')).toBe(true);
  });

  it('should use default neutral colour and md size classes when no inputs are provided', () => {
    host.label.set('');
    host.colour.set('neutral');
    host.size.set('md');
    host.customClass.set('');
    fixture.detectChanges();

    expect(pillElement.classList.contains('bg-slate-500/20')).toBe(true);
    expect(pillElement.classList.contains('text-slate-400')).toBe(true);
    expect(pillElement.classList.contains('ps-3')).toBe(true);
    expect(pillElement.classList.contains('pe-3')).toBe(true);
  });

  it('should have non-empty trimmed class list for any state', () => {
    host.label.set('Status');
    host.colour.set('neutral');
    host.size.set('sm');
    host.customClass.set('');
    fixture.detectChanges();

    const classString = pillElement.getAttribute('class');
    expect(classString?.split(' ').filter(Boolean).length).toBeGreaterThan(0);
  });
});
