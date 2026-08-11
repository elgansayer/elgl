import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('terms')
  getTerms() {
    return this.legalService.getTermsOfService();
  }

  @Get('privacy')
  getPrivacy() {
    return this.legalService.getPrivacyPolicy();
  }

  @Get(':type')
  getDocument(@Param('type') type: string) {
    if (type === 'tos') return this.legalService.getTermsOfService();
    if (type === 'privacy') return this.legalService.getPrivacyPolicy();
    throw new NotFoundException('Legal document not found');
  }
}
