import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CulturalController } from './cultural.controller';
import { CulturalService } from './cultural.service';

describe('CulturalController', () => {
  let controller: CulturalController;
  let service: CulturalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CulturalController],
      providers: [
        {
          provide: CulturalService,
          useValue: {
            getGuideForLanguage: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CulturalController>(CulturalController);
    service = module.get<CulturalService>(CulturalService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the guide for a known language', () => {
    (service.getGuideForLanguage as Mock).mockReturnValue('Bonjour!');
    const result = controller.getGuide('fr');
    expect(service.getGuideForLanguage).toHaveBeenCalledWith('fr');
    expect(result).toEqual({ language: 'fr', guide: 'Bonjour!' });
  });

  it('should throw NotFoundException for an unknown language', () => {
    (service.getGuideForLanguage as Mock).mockReturnValue(undefined);
    expect(() => controller.getGuide('xx')).toThrow(NotFoundException);
  });
});
