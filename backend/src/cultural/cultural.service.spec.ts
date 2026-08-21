import { Test, TestingModule } from '@nestjs/testing';
import { CulturalService } from './cultural.service';

describe('CulturalService', () => {
  let service: CulturalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CulturalService],
    }).compile();

    service = module.get<CulturalService>(CulturalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the guide text for an exact language code', () => {
    expect(service.getGuideForLanguage('fr')).toContain('Bonjour');
  });

  it('should match a regional locale against its base language code', () => {
    expect(service.getGuideForLanguage('fr-CA')).toContain('Bonjour');
  });

  it('should return undefined when no guide exists for the language', () => {
    expect(service.getGuideForLanguage('xx')).toBeUndefined();
  });
});
