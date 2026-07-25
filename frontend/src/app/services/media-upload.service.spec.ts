import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MediaUploadService } from './media-upload.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('MediaUploadService', () => {
  let service: MediaUploadService;
  let httpMock: HttpTestingController;
  let xhrMock: jest.SpyInstance;

  const mockAuthService = {
    getAccessToken: jest.fn().mockReturnValue('mock-token'),
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
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request presigned URL and return mediaUrl for image', async () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

    // Mock the XHR PUT call
    const xhrSend = jest.fn();
    const xhrOpen = jest.fn();
    const xhrSetHeader = jest.fn();
    const mockXhr = {
      open: xhrOpen,
      setRequestHeader: xhrSetHeader,
      upload: { onprogress: null as unknown as (e: ProgressEvent) => void },
      onload: null as unknown as () => void,
      onerror: null as unknown as () => void,
      status: 200,
      send: jest.fn().mockImplementation(function (this: typeof mockXhr) {
        // Immediately trigger onload
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }),
    };
    xhrMock = jest.spyOn(window, 'XMLHttpRequest' as never).mockReturnValue(mockXhr as unknown as XMLHttpRequest);

    const uploadPromise = service.uploadMomentMedia(file);

    // Respond to presigned URL request
    const req = httpMock.expectOne(`${environment.apiUrl}/media/moments/presigned-url`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.contentType).toBe('image/jpeg');
    expect(req.request.body.folder).toBe('moments');

    req.flush({
      uploadUrl: 'https://r2.example.com/upload',
      mediaUrl: 'https://cdn.example.com/moments/user/photo.jpg',
      objectKey: 'moments/user/photo.jpg',
      mediaKind: 'image',
    });

    const result = await uploadPromise;
    expect(result.mediaUrl).toBe('https://cdn.example.com/moments/user/photo.jpg');
    expect(result.mediaKind).toBe('image');
  });

  it('should use moments-video folder for video files', async () => {
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' });

    const mockXhr = {
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      upload: { onprogress: null },
      onload: null as unknown as () => void,
      onerror: null,
      status: 200,
      send: jest.fn().mockImplementation(function (this: typeof mockXhr) {
        setTimeout(() => { if (this.onload) this.onload(); }, 0);
      }),
    };
    jest.spyOn(window, 'XMLHttpRequest' as never).mockReturnValue(mockXhr as unknown as XMLHttpRequest);

    const uploadPromise = service.uploadMomentMedia(file);

    const req = httpMock.expectOne(`${environment.apiUrl}/media/moments/presigned-url`);
    expect(req.request.body.folder).toBe('moments-video');

    req.flush({
      uploadUrl: 'https://r2.example.com/upload',
      mediaUrl: 'https://cdn.example.com/moments-video/user/clip.mp4',
      objectKey: 'moments-video/user/clip.mp4',
      mediaKind: 'video',
    });

    const result = await uploadPromise;
    expect(result.mediaKind).toBe('video');
  });
});
