import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CulturalTipComponent } from './cultural-tip.component';

describe('CulturalTipComponent', () => {
  let component: CulturalTipComponent;
  let fixture: ComponentFixture<CulturalTipComponent>;
  let httpTesting: HttpTestingController;

  const flushGuide = async (
    guide = 'Bowing is the customary greeting in Japan.',
  ): Promise<HTMLElement> => {
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[role="region"]') as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CulturalTipComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CulturalTipComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('language', 'ja');
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
  });

  it('should render the guide text once the API responds', async () => {
    const region = await flushGuide();

    expect(fixture.nativeElement.textContent).toContain(
      'Bowing is the customary greeting in Japan.',
    );
    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-label')).toBeTruthy();
    expect(region.hasAttribute('aria-labelledby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#cultural-tip-heading')).toBeNull();
  });

  it('should use Relay theme tokens and mobile-first responsive spacing', async () => {
    const region = await flushGuide();
    const heading: HTMLElement = fixture.nativeElement.querySelector('h3');

    expect(region.classList).toContain('rounded-card');
    expect(region.classList).toContain('bg-surface-100');
    expect(region.classList).toContain('border-primary');
    expect(region.classList).toContain('text-text-secondary');
    expect(region.classList).toContain('shadow-card');
    expect(region.classList).toContain('px-4');
    expect(region.classList).toContain('sm:px-5');
    expect(region.classList).not.toContain('bg-surface-2');
    expect(region.classList).not.toContain('rounded-xl');
    expect(region.classList).not.toContain('border-accent');
    expect(heading.classList).toContain('text-text-primary');
  });

  it('should remain a named, non-interactive region with no tab stops', async () => {
    const region = await flushGuide();

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBeTruthy();
    expect(region.hasAttribute('tabindex')).toBe(false);
    expect(
      region.querySelectorAll('a, button, input, select, textarea, [tabindex], [role="button"]')
        .length,
    ).toBe(0);
  });

  it('should keep directional layout logical so the accent edge follows RTL', async () => {
    const region = await flushGuide();
    const classes = [...region.classList];

    expect(classes).toContain('border-s-4');
    expect(classes.some((name) => /^(?:border|rounded|m|p)[lr]-/.test(name))).toBe(false);
    expect(region.getAttribute('dir')).toBeNull();
  });

  it('should keep content reflowable at high zoom and with long unbroken text', async () => {
    const region = await flushGuide('A'.repeat(512));
    const classes = [...region.classList];
    const paragraph: HTMLElement = region.querySelector('p')!;

    expect(region.getAttribute('style')).toBeNull();
    expect(paragraph.getAttribute('style')).toBeNull();
    expect(classes).not.toContain('overflow-hidden');
    expect(classes).not.toContain('truncate');
    expect(classes).not.toContain('whitespace-nowrap');
    expect(classes.some((name) => /^(?:h|w|min-h|min-w|max-h|max-w)-/.test(name))).toBe(false);
    expect(paragraph.classList).not.toContain('whitespace-nowrap');
    expect(paragraph.classList).not.toContain('truncate');
    expect(paragraph.textContent).toHaveLength(512);
  });

  it('should not add pointer-only behavior, text-selection blocking, or motion', async () => {
    const region = await flushGuide();
    const renderedClasses = [region, ...Array.from(region.querySelectorAll<HTMLElement>('*'))]
      .flatMap((element) => [...element.classList])
      .join(' ');

    expect(region.onclick).toBeNull();
    expect(renderedClasses).not.toMatch(/(?:^|\s)cursor-pointer(?:\s|$)/);
    expect(renderedClasses).not.toMatch(/(?:^|\s)select-none(?:\s|$)/);
    expect(renderedClasses).not.toMatch(/(?:^|\s)(?:animate-|transition-)/);
  });

  it('should render nothing when no guide is found for the language', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="region"]')).toBeNull();
  });

  it('should refetch when the language input changes', async () => {
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
    await fixture.whenStable();

    fixture.componentRef.setInput('language', 'fr');
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://localhost:3000/api/cultural-guides/fr');
    req.flush({ language: 'fr', guide: 'Bonjour is the customary greeting in France.' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Bonjour is the customary greeting in France.',
    );
  });
});
