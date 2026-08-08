import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LinkPreviewController } from './link-preview.controller';
import { LinkPreviewService } from './link-preview.service';

describe('LinkPreviewController', () => {
  let controller: LinkPreviewController;
  let service: { getPreview: jest.Mock };

  beforeEach(async () => {
    service = {
      getPreview: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LinkPreviewController],
      providers: [
        { provide: LinkPreviewService, useValue: service },
      ],
    }).compile();

    controller = moduleRef.get<LinkPreviewController>(LinkPreviewController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPreview', () => {
    it('should throw an HttpException with BAD_REQUEST when url query parameter is missing', async () => {
      await expect(controller.getPreview(undefined as unknown as string)).rejects.toThrow(
        new HttpException('Missing url query parameter', HttpStatus.BAD_REQUEST),
      );
      expect(service.getPreview).not.toHaveBeenCalled();
    });

    it('should throw an HttpException with BAD_REQUEST when url is empty string', async () => {
      await expect(controller.getPreview('')).rejects.toThrow(
        new HttpException('Missing url query parameter', HttpStatus.BAD_REQUEST),
      );
      expect(service.getPreview).not.toHaveBeenCalled();
    });

    it('should delegate to LinkPreviewService.getPreview and return its result', async () => {
      const preview = {
        url: 'https://example.com',
        title: 'Example Title',
        description: 'Example description',
        image: 'https://example.com/img.png',
        siteName: 'Example',
      };

      service.getPreview.mockResolvedValue(preview);

      const result = await controller.getPreview('https://example.com');

      expect(result).toEqual(preview);
      expect(service.getPreview).toHaveBeenCalledTimes(1);
      expect(service.getPreview).toHaveBeenCalledWith('https://example.com');
    });

    it('should propagate errors from the service', async () => {
      const serviceError = new HttpException(
        'Unable to fetch preview for this URL',
        HttpStatus.BAD_REQUEST,
      );

      service.getPreview.mockRejectedValue(serviceError);

      await expect(controller.getPreview('https://invalid.example.com')).rejects.toThrow(
        serviceError,
      );
      expect(service.getPreview).toHaveBeenCalledTimes(1);
    });

    it('should return null when service returns null (no preview data)', async () => {
      service.getPreview.mockResolvedValue(null);

      const result = await controller.getPreview('https://example.com/no-meta');

      expect(result).toBeNull();
      expect(service.getPreview).toHaveBeenCalledTimes(1);
    });
  });
});