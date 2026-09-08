import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CulturalGuideService } from './cultural-guide.service';

describe('CulturalGuideService', () => {
  let service: CulturalGuideService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CulturalGuideService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should return the guide text for a language', async () => {
    const guidePromise = service.fetchGuide('fr');

    const req = httpMock.expectOne('http://127.0.0.1:3000/api/cultural-guides/fr');
    expect(req.request.method).toBe('GET');
    req.flush({ language: 'fr', guide: 'Bonjour is the customary greeting.' });

    const guide = await guidePromise;
    expect(guide).toBe('Bonjour is the customary greeting.');
  });

  it('should resolve to null when no guide exists for the language', async () => {
    const guidePromise = service.fetchGuide('xx');

    const req = httpMock.expectOne('http://127.0.0.1:3000/api/cultural-guides/xx');
    req.flush('Not Found', { status: 404, statusText: 'Not Found' });

    expect(await guidePromise).toBeNull();
  });

  it('should resolve to null on a network error', async () => {
    const guidePromise = service.fetchGuide('fr');

    const req = httpMock.expectOne('http://127.0.0.1:3000/api/cultural-guides/fr');
    req.error(new ProgressEvent('Network error'));

    expect(await guidePromise).toBeNull();
  });
});
