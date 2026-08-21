import { Test } from '@nestjs/testing';
import { LegalService } from './legal.service';
import { ConfigService } from '@nestjs/config';

describe('LegalService', () => {
  let service: LegalService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LegalService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue('2026-07-01') },
        },
      ],
    }).compile();

    service = moduleRef.get(LegalService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getTermsOfService', () => {
    it('should return the Terms of Service document with all sections', () => {
      const result = service.getTermsOfService();

      expect(result.title).toBe('Terms of Service');
      expect(result.lastUpdated).toBe('2026-07-01');
      expect(result.sections.length).toBeGreaterThanOrEqual(6);
      expect(result.sections[0].id).toBe('acceptance');
      expect(result.sections[0].heading).toBe('1. Acceptance of Terms');
      expect(result.sections[0].content).toBeTruthy();

      for (const section of result.sections) {
        expect(section.id).toBeTruthy();
        expect(section.heading).toBeTruthy();
        expect(section.content).toBeTruthy();
      }
    });

    it('should use TOS_EFFECTIVE_DATE from config when available', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LegalService,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) =>
                key === 'TOS_EFFECTIVE_DATE' ? '2026-09-01' : null,
              ),
            },
          },
        ],
      }).compile();
      const customService = moduleRef.get(LegalService);
      const result = customService.getTermsOfService();
      expect(result.lastUpdated).toBe('2026-09-01');
    });
  });

  describe('getPrivacyPolicy', () => {
    it('should return the Privacy Policy document with all sections', () => {
      const result = service.getPrivacyPolicy();

      expect(result.title).toBe('Privacy Policy');
      expect(result.lastUpdated).toBe('2026-07-01');
      expect(result.sections.length).toBeGreaterThanOrEqual(6);
      expect(result.sections[0].id).toBe('information-we-collect');
      expect(result.sections[0].content).toBeTruthy();

      for (const section of result.sections) {
        expect(section.id).toBeTruthy();
        expect(section.heading).toBeTruthy();
        expect(section.content).toBeTruthy();
      }
    });

    it('should use PRIVACY_EFFECTIVE_DATE from config when available', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LegalService,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn((key: string) =>
                key === 'PRIVACY_EFFECTIVE_DATE' ? '2026-08-15' : null,
              ),
            },
          },
        ],
      }).compile();
      const customService = moduleRef.get(LegalService);
      const result = customService.getPrivacyPolicy();
      expect(result.lastUpdated).toBe('2026-08-15');
    });
  });
});
