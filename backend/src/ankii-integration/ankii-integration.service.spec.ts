import { Test, TestingModule } from '@nestjs/testing';
import { AnkiiIntegrationService } from './ankii-integration.service';

describe('AnkiiIntegrationService', () => {
  let service: AnkiiIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnkiiIntegrationService],
    }).compile();

    service = module.get<AnkiiIntegrationService>(AnkiiIntegrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
