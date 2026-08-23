import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatMediaService } from './chat-media.service';
import { ImageCompressionService } from './image-compression.service';

describe('ChatMediaService', () => {
  let service: ChatMediaService;
  let httpMock: HttpTestingController;
  const compressImage = vi.fn();
  const auth = { getAccessToken: vi.fn(() => 'access-token') };

  beforeEach(() => {
    compressImage.mockReset();
    auth.getAccessToken.mockReturnValue('access-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatMediaService,
        { provide: AuthService, useValue: auth },
        { provide: ImageCompressionService, useValue: { compressImage } },
      ],
    });
    service = TestBed.inject(ChatMediaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('compresses a standard photo before requesting a bounded presign and PUTs directly', async () => {
    const original = new File(['original'], 'photo.png', { type: 'image/png' });
    const prepared = new File(['prepared'], 'photo.jpg', { type: 'image/jpeg' });
    compressImage.mockResolvedValue(prepared);

    const uploadPromise = service.upload(original, 'standard');
    await Promise.resolve();

    expect(compressImage).toHaveBeenCalledWith(original, 1600, 1600, 0.78);
    const presign = httpMock.expectOne(`${environment.apiUrl}/media/chat/presigned-url`);
    expect(presign.request.method).toBe('POST');
    expect(presign.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(presign.request.body).toEqual({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      quality: 'standard',
      sizeBytes: prepared.size,
    });
    presign.flush({
      uploadUrl: 'https://upload.example/object',
      mediaUrl: 'https://cdn.example/object.jpg',
      objectKey: 'chat-media/user/image/standard/object.jpg',
      mediaKind: 'image',
      quality: 'standard',
      maxBytes: 6 * 1024 * 1024,
    });

    await Promise.resolve();
    const put = httpMock.expectOne('https://upload.example/object');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toBe(prepared);
    expect(put.request.headers.get('Content-Type')).toBe('image/jpeg');
    put.flush('ok');

    await expect(uploadPromise).resolves.toEqual({
      url: 'https://cdn.example/object.jpg',
      kind: 'image',
      quality: 'standard',
    });
  });

  it('keeps HD video bytes intact and asks for an HD ticket', async () => {
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const uploadPromise = service.upload(video, 'hd');

    const presign = httpMock.expectOne(`${environment.apiUrl}/media/chat/presigned-url`);
    expect(compressImage).not.toHaveBeenCalled();
    expect(presign.request.body.quality).toBe('hd');
    expect(presign.request.body.sizeBytes).toBe(video.size);
    presign.flush({
      uploadUrl: 'https://upload.example/video',
      mediaUrl: 'https://cdn.example/video.mp4',
      objectKey: 'chat-media/user/video/hd/video.mp4',
      mediaKind: 'video',
      quality: 'hd',
      maxBytes: 25 * 1024 * 1024,
    });

    await Promise.resolve();
    const put = httpMock.expectOne('https://upload.example/video');
    expect(put.request.body).toBe(video);
    put.flush('ok');

    await expect(uploadPromise).resolves.toEqual({
      url: 'https://cdn.example/video.mp4',
      kind: 'video',
      quality: 'hd',
    });
  });

  it('rejects unsupported file types before any network request', async () => {
    const svg = new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' });
    await expect(service.upload(svg, 'hd')).rejects.toThrow('Unsupported photo or video format');
  });

  it('fails closed when the user is not authenticated', async () => {
    auth.getAccessToken.mockReturnValue(null as never);
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    await expect(service.upload(video, 'standard')).rejects.toThrow(
      'Sign in before uploading chat media',
    );
  });
});
