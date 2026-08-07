import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('document/:type')
  getDocument(@Param('type') type: string) {
    if (type !== 'tos' && type !== 'privacy') {
      throw new NotFoundException('Document type not found');
    }
    const doc = this.legalService.getDocument(type as 'tos' | 'privacy');
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }
}