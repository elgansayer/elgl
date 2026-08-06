import { Test, TestingModule } from '@nestjs/testing';
import { PronunciationScoringService } from './pronunciation-scoring.service';

describe('PronunciationScoringService', () => {
  let service: PronunciationScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PronunciationScoringService],
    }).compile();

    service = module.get<PronunciationScoringService>(PronunciationScoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
