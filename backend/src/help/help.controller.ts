import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HelpService } from './help.service';
import { HelpQueryDto } from './dto/help-query.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('help')
@UseGuards(SupabaseAuthGuard)
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

  @Get('quick-replies')
  getQuickReplies(): string[] {
    return this.helpService.getQuickReplies();
  }
}
