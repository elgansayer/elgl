import { Test, TestingModule } from '@nestjs/testing';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

describe('VersionController', () => {
  let controller: VersionController;
  const mockGetVersion = jest.fn();

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VersionController],
      providers: [
        {
          provide: VersionService,
          useValue: {
            getVersion: mockGetVersion,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<VersionController>(VersionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVersion', () => {
    it('should return version object from the service without an update URL', () => {
      const versionInfo = {
        current: '1.0.0',
        latest: '1.0.0',
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
      };

      mockGetVersion.mockReturnValue(versionInfo);

      expect(controller.getVersion()).toEqual(versionInfo);
    });
  });
});
