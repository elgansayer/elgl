import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { CulturalService } from './cultural.service';

@Controller('cultural-guides')
export class CulturalController {
  constructor(private readonly culturalService: CulturalService) {}

  @Get(':language')
  getGuide(@Param('language') language: string) {
    const guide = this.culturalService.getGuideForLanguage(language);
    if (!guide) {
      throw new NotFoundException(
        `No cultural guide for language "${language}"`,
      );
    }
    return { language, guide };
  }
}
