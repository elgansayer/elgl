import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UploadService, UploadResult } from './upload.service';
import { environment } from '../../environments/environment';

describe('UploadService', () => {
  let service: UploadService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UploadService],
    });

    service = TestBed.inject(UploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload avatar and return the upload result', async () => {
    const mockFile = new Blob(['test content'], { type: 'text/plain' });
    const mockFilename = 'test-avatar.txt';
    const mockResponse: UploadResult = { url: 'https://example.com/test-avatar.txt' };

    const uploadPromise = service.uploadAvatar(mockFile, mockFilename);

    const req = httpMock.expectOne(`${environment.apiUrl}/media/avatar/upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);

    const formData = req.request.body as FormData;
    const uploaded = formData.get('file') as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe(mockFilename);
    expect(await uploaded.text()).toBe('test content');

    req.flush(mockResponse);

    const result = await uploadPromise;
    expect(result).toEqual(mockResponse);
  });
});
