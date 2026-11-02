import { Controller, Get, Header, Param } from '@nestjs/common';
import type { LegalDocumentDto } from './dto/legal-document.dto';
import { LegalService } from './legal.service';

const PUBLIC_LEGAL_CACHE_CONTROL =
  'public, max-age=300, stale-while-revalidate=86400';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('terms')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getTerms(): LegalDocumentDto {
    return this.legalService.getTermsOfService();
  }

  @Get('privacy')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getPrivacy(): LegalDocumentDto {
    return this.legalService.getPrivacyPolicy();
  }

  @Get('document/:type')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getDocumentByType(@Param('type') type: string): LegalDocumentDto {
    return this.legalService.getDocument(type);
  }

  @Get(':type')
  @Header('Cache-Control', PUBLIC_LEGAL_CACHE_CONTROL)
  getDocument(@Param('type') type: string): LegalDocumentDto {
    return this.legalService.getDocument(type);
  }
}
