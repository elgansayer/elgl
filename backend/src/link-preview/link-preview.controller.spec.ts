import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';

describe('LinkPreviewController', () => {
  let controller: LinkPreviewController;
  let service: { getPreview: jest.Mock };

  beforeEach(async () => {
    service = {
      getPreview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkPreviewController],
      providers: [{ provide: LinkPreviewService, useValue: service }],
    }).compile();

    controller = module.get(LinkPreviewController);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns a link preview for a valid URL', async () => {
    const preview = {
      url: 'https://example.com',
      title: 'Example',
      description: 'A description',
      image: 'https://example.com/img.png',
      siteName: 'Example Site',
    };
    service.getPreview.mockResolvedValue(preview);

    const result = await controller.getPreview('https://example.com');

    expect(result).toEqual(preview);
    expect(service.getPreview).toHaveBeenCalledWith('https://example.com');
  });

  it('returns null when preview extraction produces nothing', async () => {
    service.getPreview.mockResolvedValue(null);

    const result = await controller.getPreview('https://example.com/invalid');

    expect(result).toBeNull();
    expect(service.getPreview).toHaveBeenCalledWith(
      'https://example.com/invalid',
    );
  });

  it('throws a BAD_REQUEST HttpException when url query parameter is empty', async () => {
    try {
      await controller.getPreview('');
      fail('Expected HttpException to be thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(400);
        expect(error.message).toBe('Missing url query parameter');
      }
    }
    expect(service.getPreview).not.toHaveBeenCalled();
  });

  it('throws a BAD_REQUEST HttpException when url is undefined', async () => {
    try {
      await controller.getPreview(undefined as unknown as string);
      fail('Expected HttpException to be thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(400);
      }
    }
    expect(service.getPreview).not.toHaveBeenCalled();
  });

  it('throws a BAD_REQUEST HttpException when url is null', async () => {
    try {
      await controller.getPreview(null as unknown as string);
      fail('Expected HttpException to be thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(400);
      }
    }
    expect(service.getPreview).not.toHaveBeenCalled();
  });

  it('propagates service exceptions to the caller', async () => {
    service.getPreview.mockRejectedValue(new HttpException('Malformed URL', 400));

    try {
      await controller.getPreview('not-a-url');
      fail('Expected HttpException to be thrown');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(400);
        expect(error.message).toBe('Malformed URL');
      }
    }
  });
});