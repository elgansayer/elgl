import { BadRequestException } from '@nestjs/common';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { ChatMediaUploadService } from './chat-media-upload.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatMediaUploadService', () => {
  const createUploadUrl = vi.fn();
  const r2ObjectService = { createUploadUrl } as unknown as R2ObjectService;
  const insert = vi.fn().mockResolvedValue({ error: null });
  const supabaseService = {
    getClient: () => ({ from: () => ({ insert }) }),
  } as unknown as SupabaseService;
  let service: ChatMediaUploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    createUploadUrl.mockReturnValue({
      uploadUrl: 'https://gateway.example/upload',
      publicUrl: 'https://cdn.example/chat-media/file.jpg',
    });
    insert.mockResolvedValue({ error: null });
    service = new ChatMediaUploadService(r2ObjectService, supabaseService);
  });

  it('creates a standard image ticket with a server-owned object path and 6 MiB ceiling', async () => {
    const ticket = await service.createUploadTicket('user-123', {
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

  it('gives HD video uploads the bounded 25 MiB ticket', async () => {
    const ticket = await service.createUploadTicket('user-456', {
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

  it('rejects a file that exceeds the selected quality ceiling before signing', async () => {
    await expect(
      service.createUploadTicket('user-123', {
        filename: 'large.mp4',
        contentType: 'video/mp4',
        quality: 'standard',
        sizeBytes: 13 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects unsupported media types before signing', async () => {
    await expect(
      service.createUploadTicket('user-123', {
        filename: 'payload.svg',
        contentType: 'image/svg+xml',
        quality: 'hd',
        sizeBytes: 512,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });

  describe('doodle uploads', () => {
    const doodleRequest = {
      filename: 'ignored-client-name.png',
      contentType: 'image/png',
      quality: 'standard' as const,
      sizeBytes: 48_000,
      purpose: 'doodle' as const,
    };

    it('creates a doodle ticket under a dedicated server-owned path with a 2 MiB ceiling', async () => {
      const ticket = await service.createUploadTicket(
        'user-123',
        doodleRequest,
      );

      expect(ticket.mediaKind).toBe('doodle');
      expect(ticket.quality).toBe('standard');
      expect(ticket.maxBytes).toBe(2 * 1024 * 1024);
      expect(ticket.objectKey).toMatch(
        /^chat-media\/user-123\/doodle\/standard\/\d+-[a-f0-9]{24}\.png$/,
      );
      expect(ticket.objectKey).not.toContain('ignored-client-name');
      expect(ticket.uploadUrl).toBe('https://gateway.example/upload');
      expect(createUploadUrl).toHaveBeenCalledWith(
        ticket.objectKey,
        'image/png',
        2 * 1024 * 1024,
      );
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          object_key: ticket.objectKey,
          user_id: 'user-123',
          media_kind: 'doodle',
        }),
      );
    });

    it('withholds the upload ticket when its cleanup intent cannot be persisted', async () => {
      insert.mockResolvedValueOnce({
        error: { message: 'database unavailable' },
      });

      await expect(
        service.createUploadTicket('user-123', doodleRequest),
      ).rejects.toThrow('Unable to create doodle upload intent');
    });

    it('normalises a parameterised PNG content type', async () => {
      const ticket = await service.createUploadTicket('user-123', {
        ...doodleRequest,
        contentType: 'IMAGE/PNG; charset=binary',
      });

      expect(ticket.mediaKind).toBe('doodle');
      expect(createUploadUrl).toHaveBeenCalledWith(
        ticket.objectKey,
        'image/png',
        2 * 1024 * 1024,
      );
    });

    it('gives each ticket a distinct unguessable object key', async () => {
      const first = await service.createUploadTicket('user-123', doodleRequest);
      const second = await service.createUploadTicket(
        'user-123',
        doodleRequest,
      );

      expect(first.objectKey).not.toBe(second.objectKey);
    });

    it.each(['image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4'])(
      'rejects %s as a doodle before signing',
      async (contentType) => {
        await expect(
          service.createUploadTicket('user-123', {
            ...doodleRequest,
            contentType,
          }),
        ).rejects.toThrow(
          new BadRequestException('Doodles must be PNG images'),
        );
        expect(createUploadUrl).not.toHaveBeenCalled();
      },
    );

    it('rejects HD quality for a doodle before signing', async () => {
      await expect(
        service.createUploadTicket('user-123', {
          ...doodleRequest,
          quality: 'hd',
        }),
      ).rejects.toThrow(
        new BadRequestException('Doodles only support standard quality'),
      );
      expect(createUploadUrl).not.toHaveBeenCalled();
    });

    it('rejects a doodle above the ceiling before signing but accepts the exact ceiling', async () => {
      await expect(
        service.createUploadTicket('user-123', {
          ...doodleRequest,
          sizeBytes: 2 * 1024 * 1024 + 1,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(createUploadUrl).not.toHaveBeenCalled();

      expect(
        (
          await service.createUploadTicket('user-123', {
            ...doodleRequest,
            sizeBytes: 2 * 1024 * 1024,
          })
        ).mediaKind,
      ).toBe('doodle');
    });

    it('keeps ordinary PNG photo uploads on the photo policy when no purpose is declared', async () => {
      const { purpose: _purpose, ...photoRequest } = doodleRequest;
      const ticket = await service.createUploadTicket('user-123', {
        ...photoRequest,
        quality: 'hd',
      });

      expect(ticket.mediaKind).toBe('image');
      expect(ticket.maxBytes).toBe(15 * 1024 * 1024);
      expect(ticket.objectKey).toMatch(/\/image\/hd\/.*\.png$/);
    });
  });
});
