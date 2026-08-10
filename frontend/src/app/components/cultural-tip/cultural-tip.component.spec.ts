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
    httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja').flush({
      language: 'ja',
      guide: 'Bowing is the customary greeting in Japan.',
    });
  });

  it('should render the guide text once the API responds', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://localhost:3000/api/cultural-guides/ja');
    req.flush({ language: 'ja', guide: 'Bowing is the customary greeting in Japan.' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Bowing is the customary greeting in Japan.',
    );
    const region = fixture.nativeElement.querySelector('[role="region"]');
    expect(region).toBeTruthy();
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
