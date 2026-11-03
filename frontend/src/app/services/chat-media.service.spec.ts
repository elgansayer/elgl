import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatMediaService, describeChatMediaFailure } from './chat-media.service';
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
      objectKey: 'chat-media/user/image/standard/object.jpg',
      kind: 'image',
      quality: 'standard',
    });
  });

  it('uses the HD image profile and requests an HD image ticket', async () => {
    const original = new File(['original'], 'photo.png', { type: 'image/png' });
    const prepared = new File(['prepared'], 'photo.jpg', { type: 'image/jpeg' });
    compressImage.mockResolvedValue(prepared);

    const uploadPromise = service.upload(original, 'hd');
    await Promise.resolve();

    expect(compressImage).toHaveBeenCalledWith(original, 2560, 2560, 0.9);
    const presign = httpMock.expectOne(`${environment.apiUrl}/media/chat/presigned-url`);
    expect(presign.request.body).toEqual({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
      quality: 'hd',
      sizeBytes: prepared.size,
    });
    presign.flush({
      uploadUrl: 'https://upload.example/hd-object',
      mediaUrl: 'https://cdn.example/hd-object.jpg',
      objectKey: 'chat-media/user/image/hd/hd-object.jpg',
      mediaKind: 'image',
      quality: 'hd',
      maxBytes: 15 * 1024 * 1024,
    });

    await Promise.resolve();
    const put = httpMock.expectOne('https://upload.example/hd-object');
    expect(put.request.body).toBe(prepared);
    put.flush('ok');

    await expect(uploadPromise).resolves.toEqual({
      url: 'https://cdn.example/hd-object.jpg',
      objectKey: 'chat-media/user/image/hd/hd-object.jpg',
      kind: 'image',
      quality: 'hd',
    });
  });

  it('does not request an R2 upload ticket when image compression fails', async () => {
    const original = new File(['original'], 'photo.png', { type: 'image/png' });
    compressImage.mockRejectedValue(new Error('Image compression is unavailable in this browser'));

    await expect(service.upload(original, 'standard')).rejects.toThrow(
      'Image compression is unavailable in this browser',
    );
    httpMock.expectNone(`${environment.apiUrl}/media/chat/presigned-url`);
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
      objectKey: 'chat-media/user/video/hd/video.mp4',
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

  describe('uploadDoodle', () => {
    const presignUrl = `${environment.apiUrl}/media/chat/presigned-url`;
    const doodleTicket = {
      uploadUrl: 'https://upload.example/doodle',
      mediaUrl: 'https://cdn.example/chat-media/user/doodle/standard/1-a.png',
      objectKey: 'chat-media/user/doodle/standard/1-a.png',
      mediaKind: 'doodle',
      quality: 'standard',
      maxBytes: 2 * 1024 * 1024,
    };

    /** A PNG-signed payload; the service validates the signature, not full PNG structure. */
    function pngDataUrl(payloadBytes = 16): string {
      const signature = String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
      return `data:image/png;base64,${btoa(signature + '\0'.repeat(payloadBytes))}`;
    }

    it('decodes the pad export, requests a doodle ticket and PUTs the PNG bytes directly', async () => {
      const dataUrl = pngDataUrl(100);
      const uploadPromise = service.uploadDoodle(dataUrl);

      const presign = httpMock.expectOne(presignUrl);
      expect(presign.request.method).toBe('POST');
      expect(presign.request.headers.get('Authorization')).toBe('Bearer access-token');
      expect(presign.request.body).toEqual({
        filename: 'doodle.png',
        contentType: 'image/png',
        quality: 'standard',
        sizeBytes: 108,
        purpose: 'doodle',
      });
      presign.flush(doodleTicket);

      await Promise.resolve();
      const put = httpMock.expectOne('https://upload.example/doodle');
      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.get('Content-Type')).toBe('image/png');
      const body = put.request.body as Blob;
      expect(body).toBeInstanceOf(Blob);
      expect(body.type).toBe('image/png');
      expect(body.size).toBe(108);
      expect(new Uint8Array(await body.arrayBuffer()).slice(0, 8)).toEqual(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      put.flush('ok');

      await expect(uploadPromise).resolves.toEqual({
        url: doodleTicket.mediaUrl,
        objectKey: doodleTicket.objectKey,
        kind: 'doodle',
        quality: 'standard',
      });
      expect(compressImage).not.toHaveBeenCalled();
    });

    it.each([
      ['a JPEG data URL', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='],
      ['a remote URL', 'https://evil.example/doodle.png'],
      ['an SVG data URL', 'data:image/svg+xml;base64,PHN2Zy8+'],
      ['an empty payload', 'data:image/png;base64,'],
    ])('rejects %s before any network request', async (_label, dataUrl) => {
      await expect(service.uploadDoodle(dataUrl)).rejects.toThrow('Doodle is not a PNG image');
      httpMock.expectNone(presignUrl);
    });

    it('rejects malformed base64 before any network request', async () => {
      await expect(service.uploadDoodle('data:image/png;base64,@@not base64@@')).rejects.toThrow(
        'Doodle image data is malformed',
      );
      httpMock.expectNone(presignUrl);
    });

    it('rejects base64 that is not a PNG even when the prefix claims it is', async () => {
      await expect(
        service.uploadDoodle(`data:image/png;base64,${btoa('<script>alert(1)</script>')}`),
      ).rejects.toThrow('Doodle is not a PNG image');
      httpMock.expectNone(presignUrl);
    });

    it('rejects a doodle above the 2 MB ceiling before any network request', async () => {
      await expect(service.uploadDoodle(pngDataUrl(2 * 1024 * 1024))).rejects.toThrow(
        'Doodle must be under 2 MB',
      );
      httpMock.expectNone(presignUrl);
    });

    it('does not upload when the ticket is not a doodle ticket', async () => {
      const uploadPromise = service.uploadDoodle(pngDataUrl());
      const rejection = expect(uploadPromise).rejects.toThrow(
        'Upload ticket did not match the selected media',
      );

      httpMock.expectOne(presignUrl).flush({ ...doodleTicket, mediaKind: 'image' });

      await rejection;
      httpMock.expectNone('https://upload.example/doodle');
    });

    it('does not upload when the ticket ceiling is smaller than the doodle', async () => {
      const uploadPromise = service.uploadDoodle(pngDataUrl(100));
      const rejection = expect(uploadPromise).rejects.toThrow(
        'Upload ticket did not match the selected media',
      );

      httpMock.expectOne(presignUrl).flush({ ...doodleTicket, maxBytes: 64 });

      await rejection;
      httpMock.expectNone('https://upload.example/doodle');
    });

    it('rejects when the object store refuses the upload so nothing is sent to the chat', async () => {
      const uploadPromise = service.uploadDoodle(pngDataUrl());
      const rejection = expect(uploadPromise).rejects.toMatchObject({ status: 403 });

      httpMock.expectOne(presignUrl).flush(doodleTicket);
      await Promise.resolve();
      httpMock
        .expectOne('https://upload.example/doodle')
        .flush('denied', { status: 403, statusText: 'Forbidden' });

      await rejection;
    });

    it('fails closed when the user is not authenticated', async () => {
      auth.getAccessToken.mockReturnValue(null as never);

      await expect(service.uploadDoodle(pngDataUrl())).rejects.toThrow(
        'Sign in before uploading chat media',
      );
      httpMock.expectNone(presignUrl);
    });
  });
});

describe('describeChatMediaFailure', () => {
  it('reports only the status of an HTTP failure so a signed upload URL is never logged', () => {
    const failure = new HttpErrorResponse({
      status: 403,
      statusText: 'Forbidden',
      url: 'https://upload.example/object?expires=1&signature=secret-token',
    });

    expect(failure.message).toContain('secret-token');
    expect(describeChatMediaFailure(failure)).toBe('HTTP 403');
  });

  it('reports the message of the service validation errors, which never carry a URL', () => {
    expect(describeChatMediaFailure(new Error('Doodle is not a PNG image'))).toBe(
      'Doodle is not a PNG image',
    );
  });

  it('does not stringify unknown values', () => {
    expect(describeChatMediaFailure({ token: 'secret-token' })).toBe('Unknown failure');
    expect(describeChatMediaFailure(undefined)).toBe('Unknown failure');
  });
});
