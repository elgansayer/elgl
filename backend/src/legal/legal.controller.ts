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
}
