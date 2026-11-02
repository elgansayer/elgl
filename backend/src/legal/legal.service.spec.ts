import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LegalService } from './legal.service';

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
    it('returns the Terms of Service document with all sections', () => {
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

    it('uses TOS_EFFECTIVE_DATE from config when available', async () => {
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

      expect(customService.getTermsOfService().lastUpdated).toBe('2026-09-01');
    });

    it('falls back to the bundled date when TOS_EFFECTIVE_DATE is invalid', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LegalService,
          {
            provide: ConfigService,
            useValue: { get: vi.fn().mockReturnValue('2026-02-30') },
          },
        ],
      }).compile();
      const customService = moduleRef.get(LegalService);

      expect(customService.getTermsOfService().lastUpdated).toBe('2026-07-01');
    });
  });

  describe('getPrivacyPolicy', () => {
    it('returns the Privacy Policy document with all sections', () => {
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

    it('uses PRIVACY_EFFECTIVE_DATE from config when available', async () => {
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

      expect(customService.getPrivacyPolicy().lastUpdated).toBe('2026-08-15');
    });

    it('falls back when PRIVACY_EFFECTIVE_DATE is malformed', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          LegalService,
          {
            provide: ConfigService,
            useValue: { get: vi.fn().mockReturnValue('August 15, 2026') },
          },
        ],
      }).compile();
      const customService = moduleRef.get(LegalService);

      expect(customService.getPrivacyPolicy().lastUpdated).toBe('2026-07-01');
    });
  });

  describe('getDocument', () => {
    it('returns Terms of Service for terms and terms-of-service', () => {
      expect(service.getDocument('terms').title).toBe('Terms of Service');
      expect(service.getDocument('terms-of-service').title).toBe(
        'Terms of Service',
      );
      expect(service.getDocument('  TERMS  ').title).toBe('Terms of Service');
    });

    it('returns Privacy Policy for privacy and privacy-policy', () => {
      expect(service.getDocument('privacy').title).toBe('Privacy Policy');
      expect(service.getDocument('privacy-policy').title).toBe(
        'Privacy Policy',
      );
      expect(service.getDocument('  PRIVACY  ').title).toBe('Privacy Policy');
    });

    it('throws NotFoundException for unknown document types', () => {
      expect(() => service.getDocument('unknown-policy')).toThrow(
        NotFoundException,
      );
      expect(() => service.getDocument('')).toThrow(NotFoundException);
    });

    it('does not reflect untrusted document types in logs or errors', () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const untrustedType = 'unknown\n[Admin] payment verified';

      let thrown: unknown;
      try {
        service.getDocument(untrustedType);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(NotFoundException);
      expect((thrown as Error).message).toBe('Legal document not found');
      expect((thrown as Error).message).not.toContain(untrustedType);
      expect(warnSpy).toHaveBeenCalledWith(
        'Requested unknown legal document type',
      );
      warnSpy.mockRestore();
    });

    it('rejects oversized document types before logging them', () => {
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      expect(() => service.getDocument('x'.repeat(65))).toThrow(
        NotFoundException,
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
