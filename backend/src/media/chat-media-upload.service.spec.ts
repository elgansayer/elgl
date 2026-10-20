import { BadRequestException } from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { ChatMediaUploadService } from './chat-media-upload.service';

describe('ChatMediaUploadService', () => {
  const createUploadUrl = vi.fn();
  const r2ObjectService = { createUploadUrl } as unknown as R2ObjectService;
  let service: ChatMediaUploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    createUploadUrl.mockReturnValue({
      uploadUrl: 'https://gateway.example/upload',
      publicUrl: 'https://cdn.example/chat-media/file.jpg',
    });
    service = new ChatMediaUploadService(r2ObjectService);
  });

  it('creates a standard image ticket with a server-owned object path and 6 MiB ceiling', () => {
    const ticket = service.createUploadTicket('user-123', {
      filename: 'holiday.jpeg',
      contentType: 'image/jpeg',
      quality: 'standard',
      sizeBytes: 1_000_000,
    });

    expect(ticket.mediaKind).toBe('image');
    expect(ticket.quality).toBe('standard');
    expect(ticket.maxBytes).toBe(6 * 1024 * 1024);
    expect(ticket.objectKey).toMatch(
      /^chat-media\/user-123\/image\/standard\/\d+-[a-f0-9]{24}\.jpg$/,
    );
    expect(createUploadUrl).toHaveBeenCalledWith(
      ticket.objectKey,
      'image/jpeg',
      6 * 1024 * 1024,
    );
  });

  it('gives HD video uploads the bounded 25 MiB ticket', () => {
    const ticket = service.createUploadTicket('user-456', {
      filename: 'clip.mov',
      contentType: 'video/quicktime; charset=binary',
      quality: 'hd',
      sizeBytes: 20 * 1024 * 1024,
    });

    expect(ticket.mediaKind).toBe('video');
    expect(ticket.maxBytes).toBe(25 * 1024 * 1024);
    expect(ticket.objectKey).toMatch(/\/video\/hd\/.*\.mov$/);
    expect(createUploadUrl).toHaveBeenCalledWith(
      ticket.objectKey,
      'video/quicktime',
      25 * 1024 * 1024,
    );
  });

  it('rejects a file that exceeds the selected quality ceiling before signing', () => {
    expect(() =>
      service.createUploadTicket('user-123', {
        filename: 'large.mp4',
        contentType: 'video/mp4',
        quality: 'standard',
        sizeBytes: 13 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects unsupported media types before signing', () => {
    expect(() =>
      service.createUploadTicket('user-123', {
        filename: 'payload.svg',
        contentType: 'image/svg+xml',
        quality: 'hd',
        sizeBytes: 512,
      }),
    ).toThrow(BadRequestException);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });
});
