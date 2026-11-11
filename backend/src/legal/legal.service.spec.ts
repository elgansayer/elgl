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

      expect(customService.getTermsOfService().lastUpdated).toBe('2026-11-11');
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

      expect(customService.getPrivacyPolicy().lastUpdated).toBe('2026-11-11');
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
  describe('age check and copyright wording (#2044)', () => {
    const configWith = (values: Record<string, string>) =>
      Test.createTestingModule({
        providers: [
          LegalService,
          {
            provide: ConfigService,
            useValue: { get: vi.fn((key: string) => values[key]) },
          },
        ],
      })
        .compile()
        .then((moduleRef) => moduleRef.get(LegalService));

    it('tells users the age is checked and that blocked accounts are removed', () => {
      const terms = service.getTermsOfService();
      const account = terms.sections.find(
        (section) => section.id === 'account',
      );

      expect(account?.content).toContain('at least 13 years of age');
      expect(account?.content).toContain('date of birth');
    });

    it('explains what happens to a child account without promising to keep the date', async () => {
      const custom = await configWith({
        DMCA_AGENT_EMAIL: 'privacy@example.com',
      });
      const children = custom
        .getPrivacyPolicy()
        .sections.find((section) => section.id === 'children');

      expect(children?.content).toContain('block the account immediately');
      expect(children?.content).toContain('do not store the date');
      expect(children?.content).toContain('delete the personal information');
      expect(children?.content).toContain('privacy@example.com');
    });

    it('declares the date of birth as collected data', () => {
      const collected = service
        .getPrivacyPolicy()
        .sections.find((section) => section.id === 'information-we-collect');
      expect(collected?.content).toContain('date of birth');
    });

    it.each(['dmca', 'copyright', 'copyright-policy', ' DMCA '])(
      'serves the copyright policy for %j',
      (type) => {
        expect(service.getDocument(type).title).toBe('Copyright Policy (DMCA)');
      },
    );

    it('lists the statutory elements, the counter-notification route and the repeat infringer rule', () => {
      const policy = service.getCopyrightPolicy();
      const text = (id: string) =>
        policy.sections.find((section) => section.id === id)?.content ?? '';

      expect(policy.sections.map((section) => section.id)).toEqual([
        'overview',
        'filing',
        'confirmation',
        'counter-notification',
        'repeat-infringers',
        'misrepresentation',
        'designated-agent',
      ]);
      expect(text('filing')).toContain('under penalty of perjury');
      expect(text('filing')).toContain('electronic signature');
      expect(text('confirmation')).toContain(
        'Nothing is removed until you confirm',
      );
      expect(text('counter-notification')).toContain('10 business days');
      expect(text('repeat-infringers')).toContain('three or more');
      expect(text('misrepresentation')).toContain('512(f)');
    });

    it('publishes the configured designated agent and omits blank details', async () => {
      const custom = await configWith({
        DMCA_AGENT_NAME: ' Copyright Desk ',
        DMCA_AGENT_EMAIL: 'agent@example.com',
        DMCA_AGENT_POSTAL_ADDRESS: '1 High Street, London',
        DMCA_AGENT_PHONE: '   ',
      });
      const agent = custom
        .getCopyrightPolicy()
        .sections.find((section) => section.id === 'designated-agent');

      expect(agent?.content).toBe(
        'Our designated agent for notices of claimed infringement is: Name: Copyright Desk; Email: agent@example.com; Postal address: 1 High Street, London.',
      );
    });

    it('falls back to the legal mailbox when no agent is configured', async () => {
      const custom = await configWith({});
      const agent = custom
        .getCopyrightPolicy()
        .sections.find((section) => section.id === 'designated-agent');

      expect(agent?.content).toBe(
        'Our designated agent for notices of claimed infringement is: Email: legal@hellotalk.nexus.',
      );
    });

    it('never uses an em dash in any legal text', () => {
      for (const document of [
        service.getTermsOfService(),
        service.getPrivacyPolicy(),
        service.getCopyrightPolicy(),
      ]) {
        expect(JSON.stringify(document)).not.toContain('\u2014');
      }
    });
  });
});
