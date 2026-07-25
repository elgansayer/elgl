import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MediaUploadService } from './media-upload.service';
import { AuthService } from '../auth/auth.service';

describe('MediaUploadService', () => {
  let service: MediaUploadService;
  let httpMock: HttpTestingController;
  let xhrMock: jasmine.Spy;

  const mockAuthService = {
    getAccessToken: jasmine.createSpy('getAccessToken').and.returnValue('mock-token'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MediaUploadService,
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(MediaUploadService);
    httpMock = TestBed.inject(HttpTestingController);

    const xhrSend = jasmine.createSpy('send');
    const xhrOpen = jasmine.createSpy('open');
    const xhrSetHeader = jasmine.createSpy('setRequestHeader');

    const mockXhr = {
      open: xhrOpen,
      setRequestHeader: xhrSetHeader,
      send: xhrSend.and.callFake(function (this: any) {
        if (mockXhr.onload) {
          mockXhr.onload(new Event('load'));
        }
      }),
      readyState: 4,
      status: 200,
      response: JSON.stringify({ url: 'https://cdn.example.com/test.png' }),
      onload: null as ((ev: Event) => void) | null,
    };

    xhrMock = spyOn(window, 'XMLHttpRequest' as any).and.returnValue(mockXhr as any);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should upload a file and return the presigned URL', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' });

    service.uploadFile(file).subscribe((result: any) => {
      expect(result.url).toEqual('https://cdn.example.com/test.png');
    });

    expect(xhrMock).toHaveBeenCalled();
  });
});
