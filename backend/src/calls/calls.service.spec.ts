import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CallsService } from './calls.service';

describe('CallsService', () => {
  let service: CallsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CallsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                LIVEKIT_URL: 'http://localhost:7880',
                LIVEKIT_API_KEY: 'devkey',
                LIVEKIT_SECRET: 'secret',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CallsService);
  });

  it('should throw BadRequestException when participant_limit is less than 2', async () => {
    await expect(
      service.createGroupCall('caller', ['A', 'B'], 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when participant count exceeds the limit', async () => {
    await expect(
      service.createGroupCall('caller', ['A', 'B'], 2),
    ).rejects.toThrow(BadRequestException);
  });
});
