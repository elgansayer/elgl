import { Controller, Get, Param, Query } from '@nestjs/common';
import { HelpService } from './help.service';
import { FAQ } from './interfaces/faq.interface';
import { HelpQueryDto } from './dto/help-query.dto';

@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('faqs')
  getFaqs(@Query() query: HelpQueryDto): FAQ[] {
    return this.helpService.getFaqs(query.category);
  }

  @Get('faqs/:id')
  getFaq(@Param('id') id: string): FAQ | undefined {
    return this.helpService.getFaq(id);
  }
}
