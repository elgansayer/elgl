import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyArchiveCron } from './privacy-archive.cron';
import { PrivacyService } from './privacy.service';

describe('PrivacyArchiveCron', () => {
  let cron: PrivacyArchiveCron;
  const purgeExpiredArchives = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyArchiveCron,
        {
          provide: PrivacyService,
          useValue: { purgeExpiredArchives },
        },
      ],
    }).compile();

    cron = module.get(PrivacyArchiveCron);
  });

  it('purges in bounded batches until the final partial batch', async () => {
    purgeExpiredArchives
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(7);

    await cron.purgeExpiredArchives();

    expect(purgeExpiredArchives).toHaveBeenCalledTimes(3);
    expect(purgeExpiredArchives).toHaveBeenNthCalledWith(1, 100);
    expect(purgeExpiredArchives).toHaveBeenNthCalledWith(2, 100);
    expect(purgeExpiredArchives).toHaveBeenNthCalledWith(3, 100);
  });

  it('stops after the configured maximum number of batches', async () => {
    purgeExpiredArchives.mockResolvedValue(100);

    await cron.purgeExpiredArchives();

    expect(purgeExpiredArchives).toHaveBeenCalledTimes(20);
  });

  it('contains cleanup failures so the scheduler remains healthy', async () => {
    purgeExpiredArchives.mockRejectedValue(new Error('private provider detail'));

    await expect(cron.purgeExpiredArchives()).resolves.toBeUndefined();
  });
});
