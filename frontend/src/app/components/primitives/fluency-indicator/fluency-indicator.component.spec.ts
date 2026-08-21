import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FluencyIndicatorComponent } from './fluency-indicator.component';

@Component({
  template: ` <app-fluency-indicator [nativeLanguages]="native()" [targetLanguages]="target()" /> `,
  imports: [FluencyIndicatorComponent],
})
class TestHostComponent {
  native = signal<{ code: string; level?: number }[]>([{ code: 'en' }]);
  target = signal<{ code: string; level?: number }[]>([{ code: 'es' }]);
}

describe('FluencyIndicatorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, FluencyIndicatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    root = fixture.nativeElement.querySelector('[role="img"]');
  });

  it('should create and expose an accessible name summarising native and target languages', () => {
    expect(root).toBeTruthy();
    expect(root.getAttribute('aria-label')).toBe('Speaks en; learning es');
  });

  it('should render one language-code span per native and target language', () => {
    const codes = Array.from(root.querySelectorAll('.uppercase')).map((el) =>
      el.textContent?.trim(),
    );
    expect(codes).toEqual(['en', 'es']);
  });

  it('should render target-language codes with the neon-violet token, not a hardcoded colour', () => {
    const targetCode = root.querySelector('.text-neon-violet');
    expect(targetCode).toBeTruthy();
    expect(targetCode?.textContent?.trim()).toBe('es');
    expect(root.querySelector('.text-purple-400')).toBeNull();
  });

  it('should react to signal updates with multiple languages and a separator between them', () => {
    host.native.set([{ code: 'en' }, { code: 'fr' }]);
    host.target.set([{ code: 'es' }, { code: 'de' }]);
    fixture.detectChanges();

    expect(root.getAttribute('aria-label')).toBe('Speaks en, fr; learning es, de');
    const codes = Array.from(root.querySelectorAll('.uppercase')).map((el) =>
      el.textContent?.trim(),
    );
    expect(codes).toEqual(['en', 'fr', 'es', 'de']);
    expect(root.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
