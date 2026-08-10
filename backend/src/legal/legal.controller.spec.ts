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

  describe('getDocument', () => {
    it('should return terms of service for type=tos', () => {
      const doc = controller.getDocument('tos');
      expect(doc).toBeDefined();
      expect(doc.title).toBe('Terms of Service');
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.lastUpdated).toBeDefined();
    });

    it('should return privacy policy for type=privacy', () => {
      const doc = controller.getDocument('privacy');
      expect(doc).toBeDefined();
      expect(doc.title).toBe('Privacy Policy');
      expect(doc.sections.length).toBeGreaterThan(0);
      expect(doc.lastUpdated).toBeDefined();
    });

    it('should throw NotFoundException for invalid type', () => {
      expect(() => controller.getDocument('invalid')).toThrow(
        NotFoundException,
      );
    });
  });
});
