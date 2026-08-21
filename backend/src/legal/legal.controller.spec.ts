import { Test, TestingModule } from '@nestjs/testing';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { NotFoundException } from '@nestjs/common';

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
});
