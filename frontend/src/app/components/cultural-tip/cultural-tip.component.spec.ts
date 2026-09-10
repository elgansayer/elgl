import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CulturalTipComponent } from './cultural-tip.component';

describe('CulturalTipComponent', () => {
  let component: CulturalTipComponent;
  let fixture: ComponentFixture<CulturalTipComponent>;
  let httpTesting: HttpTestingController;

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
    httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
  });

  it('should render the guide text once the API responds', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/ja');
    req.flush({ language: 'ja', guide: 'Bowing is the customary greeting in Japan.' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Bowing is the customary greeting in Japan.',
    );
    const region = fixture.nativeElement.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region.getAttribute('aria-label')).toBeTruthy();
    expect(region.hasAttribute('aria-labelledby')).toBe(false);
    expect(fixture.nativeElement.querySelector('#cultural-tip-heading')).toBeNull();
  });

  it('should use Relay theme tokens and mobile-first responsive spacing', async () => {
    fixture.detectChanges();
    httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const region: HTMLElement = fixture.nativeElement.querySelector('[role="region"]');
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

  it('should render nothing when no guide is found for the language', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/ja');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="region"]')).toBeNull();
  });

  it('should refetch when the language input changes', async () => {
    fixture.detectChanges();
    httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
    await fixture.whenStable();

    fixture.componentRef.setInput('language', 'fr');
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/cultural-guides/fr');
    req.flush({ language: 'fr', guide: 'Bonjour is the customary greeting in France.' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Bonjour is the customary greeting in France.',
    );
  });
});
