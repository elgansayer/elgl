import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatMediaController } from './chat-media.controller';
import { ChatMediaUploadService } from './chat-media-upload.service';
import { ChatMediaUploadDto } from './dto/chat-media-upload.dto';

describe('ChatMediaController', () => {
  const createUploadTicket = vi.fn();
  let controller: ChatMediaController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatMediaController],
      providers: [
        {
          provide: ChatMediaUploadService,
          useValue: { createUploadTicket },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ChatMediaController);
  });

  it('requires an authenticated session for every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatMediaController)).toContain(
      SupabaseAuthGuard,
    );
  });

  it('issues upload tickets for the authenticated user, never a body-supplied identity', () => {
    const ticket = {
      uploadUrl: 'https://gateway.example/upload',
      mediaUrl: 'https://cdn.example/chat-media/user-1/doodle/standard/1-a.png',
      objectKey: 'chat-media/user-1/doodle/standard/1-a.png',
      mediaKind: 'doodle',
      quality: 'standard',
      maxBytes: 2 * 1024 * 1024,
    };
    createUploadTicket.mockReturnValue(ticket);
    const dto = Object.assign(new ChatMediaUploadDto(), {
      filename: 'doodle.png',
      contentType: 'image/png',
      quality: 'standard',
      sizeBytes: 48_000,
      purpose: 'doodle',
    });

    const result = controller.createPresignedUrl(
      { user: { id: 'user-1' } },
      dto,
    );

    expect(createUploadTicket).toHaveBeenCalledWith('user-1', dto);
    expect(result).toBe(ticket);
  });

  it('propagates policy rejections from the upload service', () => {
    createUploadTicket.mockImplementation(() => {
      throw new Error('Doodles must be PNG images');
    });

    expect(() =>
      controller.createPresignedUrl(
        { user: { id: 'user-1' } },
        new ChatMediaUploadDto(),
      ),
    ).toThrow('Doodles must be PNG images');
  });
});
