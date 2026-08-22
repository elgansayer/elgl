import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';

describe('LinkPreviewController', () => {
  let controller: LinkPreviewController;
  const mockGetPreview = vi.fn();

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LinkPreviewController],
      providers: [
        {
          provide: LinkPreviewService,
          useValue: { getPreview: mockGetPreview },
        },
      ],
    }).compile();

    controller = moduleRef.get<LinkPreviewController>(LinkPreviewController);
  });

  afterEach(() => vi.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('requires Supabase authentication for the network scraper endpoint', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      LinkPreviewController,
    ) as unknown[];

    expect(guards).toContain(SupabaseAuthGuard);
  });

  it('rejects a request without a url query parameter', async () => {
    await expect(controller.getPreview('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.getPreview(undefined as unknown as string),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockGetPreview).not.toHaveBeenCalled();
  });

  it('delegates to the service and returns the scraped preview', async () => {
    const preview = {
      url: 'https://example.com/post',
      title: 'Great Article',
      description: 'A description',
      image: 'https://example.com/img/cover.png',
      siteName: 'Example',
    };
    mockGetPreview.mockResolvedValue(preview);

    await expect(
      controller.getPreview('https://example.com/post'),
    ).resolves.toEqual(preview);
    expect(mockGetPreview).toHaveBeenCalledWith('https://example.com/post');
    expect(mockGetPreview).toHaveBeenCalledTimes(1);
  });

  it('passes through a null preview when the page exposes no metadata', async () => {
    mockGetPreview.mockResolvedValue(null);

    await expect(
      controller.getPreview('https://example.com/empty'),
    ).resolves.toBeNull();
  });

  it('propagates service errors to the caller', async () => {
    mockGetPreview.mockRejectedValue(new BadRequestException('Malformed URL'));

    await expect(controller.getPreview('not a url')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
