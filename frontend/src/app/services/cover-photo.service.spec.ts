import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CoverPhotoService } from './cover-photo.service';
import { environment } from '../../environments/environment';

describe('CoverPhotoService', () => {
  let service: CoverPhotoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CoverPhotoService,
      ],
    });
    service = TestBed.inject(CoverPhotoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should upload a blob and return the url', async () => {
    const fakeBlob = new Blob(['fake-image'], { type: 'image/webp' });
    const expectedUrl = 'https://r2.example.com/cover/user123.webp';
    const endpoint = `${environment.apiUrl}/media/cover/upload`;

    const uploadPromise = service.upload(fakeBlob);

    const req = httpMock.expectOne(endpoint);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.has('file')).toBe(true);

    req.flush({ coverUrl: expectedUrl });

    await expect(uploadPromise).resolves.toBe(expectedUrl);
  });

  it('should reject on network error', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/webp' });
    const endpoint = `${environment.apiUrl}/media/cover/upload`;
    const uploadPromise = service.upload(fakeBlob);

    const req = httpMock.expectOne(endpoint);
    req.error(new ProgressEvent('Network error'));

    let caught: unknown;
    try {
      await uploadPromise;
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
  });
});
