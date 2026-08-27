import { Controller, Get, Header } from '@nestjs/common';
import { LegalService } from './legal.service';

const PUBLIC_LEGAL_CACHE_CONTROL =
  'public, max-age=300, stale-while-revalidate=86400';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('terms')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getTerms() {
    return this.legalService.getTermsOfService();
  }

  @Get('privacy')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getPrivacy() {
    return this.legalService.getPrivacyPolicy();
  }
}
