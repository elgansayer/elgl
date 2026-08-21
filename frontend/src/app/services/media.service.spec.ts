import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ImageCompressionService } from './image-compression.service';
import { MediaService } from './media.service';
import { SupabaseService } from './supabase.service';

describe('MediaService voice-note uploads', () => {
  let service: MediaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MediaService,
        {
          provide: ImageCompressionService,
          useValue: { compressImage: vi.fn() },
        },
        {
          provide: SupabaseService,
          useValue: { clearOfflineCache: vi.fn() },
        },
      ],
    });

    service = TestBed.inject(MediaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('requests a user-scoped presign then PUTs the blob directly to R2', async () => {
    const blob = new Blob(['voice'], { type: 'audio/webm;codecs=opus' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);

    const uploadPromise = service.uploadVoiceNote(blob);
    const req = httpMock.expectOne(`${environment.apiUrl}/media/voice-note/presigned-url`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      filename: expect.stringMatching(/^voice_\d+\.webm$/),
      contentType: 'audio/webm;codecs=opus',
    });
    req.flush({
      uploadUrl: 'https://gateway.example.test/upload-token',
      mediaUrl: 'https://media.example.test/voice.webm',
      objectKey: 'voice-notes/user-1/voice.webm',
    });

    await expect(uploadPromise).resolves.toEqual({
      url: 'https://media.example.test/voice.webm',
    });
    expect(fetchSpy).toHaveBeenCalledWith('https://gateway.example.test/upload-token', {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/webm;codecs=opus' },
      body: blob,
    });
  });

  it('fails closed when the direct R2 PUT is rejected', async () => {
    const blob = new Blob(['voice'], { type: 'audio/ogg' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);

    const uploadPromise = service.uploadVoiceNote(blob);
    const req = httpMock.expectOne(`${environment.apiUrl}/media/voice-note/presigned-url`);
    req.flush({
      uploadUrl: 'https://gateway.example.test/upload-token',
      mediaUrl: 'https://media.example.test/voice.ogg',
      objectKey: 'voice-notes/user-1/voice.ogg',
    });

    await expect(uploadPromise).rejects.toThrow('Voice note upload failed');
  });

  it('rejects empty and oversized blobs before requesting an upload URL', async () => {
    await expect(service.uploadVoiceNote(new Blob([]))).rejects.toThrow(
      'Voice note is outside the supported upload size',
    );

    const oversized = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], {
      type: 'audio/webm',
    });
    await expect(service.uploadVoiceNote(oversized)).rejects.toThrow(
      'Voice note is outside the supported upload size',
    );

    httpMock.expectNone(`${environment.apiUrl}/media/voice-note/presigned-url`);
  });
});
