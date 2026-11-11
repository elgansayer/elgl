import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { ALLOW_OUTDATED_CLIENT_KEY } from './client-version.constants';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

describe('VersionController', () => {
  let controller: VersionController;
  const mockGetVersion = vi.fn();
  const mockGetMinimumSupportedVersion = vi.fn();
  const mockEvaluateClientVersion = vi.fn();

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
      providers: [
        {
          provide: VersionService,
          useValue: {
            getVersion: mockGetVersion,
            getMinimumSupportedVersion: mockGetMinimumSupportedVersion,
            evaluateClientVersion: mockEvaluateClientVersion,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<VersionController>(VersionController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('exposes the minimum supported version as GET /version/minimum', () => {
    const handler = VersionController.prototype.getMinimumSupportedVersion;

    expect(Reflect.getMetadata(PATH_METADATA, VersionController)).toBe(
      'version',
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('minimum');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
  });

  it('keeps the whole controller reachable for outdated clients', () => {
    expect(
      Reflect.getMetadata(ALLOW_OUTDATED_CLIENT_KEY, VersionController),
    ).toBe(true);
  });

  it('exposes the compatibility handshake as GET /version/check', () => {
    const handler = VersionController.prototype.checkClientVersion;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('check');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    );
  });

  describe('checkClientVersion', () => {
    it('delegates the declared header value to the service', () => {
      const evaluation = {
        status: 'upgrade_required',
        minimumSupported: '2.0.0',
        latest: '2.1.0',
      };
      mockEvaluateClientVersion.mockReturnValue(evaluation);

      expect(controller.checkClientVersion('1.0.0')).toEqual(evaluation);
      expect(mockEvaluateClientVersion).toHaveBeenCalledWith('1.0.0');
    });

    it('passes a missing header through as undefined', () => {
      mockEvaluateClientVersion.mockReturnValue({ status: 'unknown' });

      controller.checkClientVersion(undefined);

      expect(mockEvaluateClientVersion).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getVersion', () => {
    it('should return version object from the service without an update URL', () => {
      const versionInfo = {
        current: '1.0.0',
        latest: '1.0.0',
        minimumSupported: '1.0.0',
      };

      mockGetVersion.mockReturnValue(versionInfo);

      expect(controller.getVersion()).toEqual(versionInfo);
      expect(mockGetVersion).toHaveBeenCalledTimes(1);
    });

    it('should include the update URL when provided by the service', () => {
      const versionInfo = {
        current: '1.0.0',
        latest: '2.0.0',
        updateUrl: 'https://example.com/download',
        minimumSupported: '1.0.0',
      };

      mockGetVersion.mockReturnValue(versionInfo);

      expect(controller.getVersion()).toEqual(versionInfo);
    });
  });

  describe('getMinimumSupportedVersion', () => {
    it('should return minimum supported version object from the service', () => {
      const minVersionInfo = {
        minimumSupported: '1.1.0',
      };

      mockGetMinimumSupportedVersion.mockReturnValue(minVersionInfo);

      expect(controller.getMinimumSupportedVersion()).toEqual(minVersionInfo);
      expect(mockGetMinimumSupportedVersion).toHaveBeenCalledTimes(1);
    });
  });
});
