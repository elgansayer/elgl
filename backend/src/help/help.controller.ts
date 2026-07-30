import { Controller, Get, Query } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpQueryDto } from './dto/help-query.dto';

@Controller('help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('articles')
  getArticles(@Query() query: HelpQueryDto) {
    return this.helpService.findAll(query);
  }

  @Get('categories')
  getCategories() {
    return this.helpService.getCategories();
  }
}
