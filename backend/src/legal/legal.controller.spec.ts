import { Test, TestingModule } from '@nestjs/testing';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

describe('LegalController', () => {
  let controller: LegalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalController],
      providers: [LegalService],
    }).compile();

    controller = module.get<LegalController>(LegalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTerms', () => {
    it('should return terms of service', () => {
      const doc = controller.getTerms();
      expect(doc).toBeDefined();
      expect(doc.title).toBe('Terms of Service');
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.lastUpdated).toBeDefined();
    });
  });

  describe('getPrivacy', () => {
    it('should return privacy policy', () => {
      const doc = controller.getPrivacy();
      expect(doc).toBeDefined();
      expect(doc.title).toBe('Privacy Policy');
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.lastUpdated).toBeDefined();
    });
  });

  describe('getDocumentByType', () => {
    it('should return document by type param', () => {
      const termsDoc = controller.getDocumentByType('terms');
      expect(termsDoc.title).toBe('Terms of Service');

      const privacyDoc = controller.getDocumentByType('privacy');
      expect(privacyDoc.title).toBe('Privacy Policy');
    });
  });

  describe('getDocument', () => {
    it('should return document by parameterized route', () => {
      const termsDoc = controller.getDocument('terms-of-service');
      expect(termsDoc.title).toBe('Terms of Service');

      const privacyDoc = controller.getDocument('privacy-policy');
      expect(privacyDoc.title).toBe('Privacy Policy');
    });
  });
});
