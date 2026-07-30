import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { CuratedContentService } from './curated-content.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { CreateDialogueDto } from './dto/create-dialogue.dto';

@Controller('curated-content')
export class CuratedContentController {
  constructor(private readonly service: CuratedContentService) {}

  @Get('articles')
  async getArticles(
    @Query('language') language?: string,
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.service.getArticles(language, cefrLevel);
  }

  @Get('articles/:id')
  async getArticleById(@Param('id') id: string) {
    return this.service.getArticleById(id);
  }

  @Post('articles')
  async createArticle(@Body() dto: CreateArticleDto) {
    return this.service.createArticle(dto);
  }

  @Get('dialogues')
  async getDialogues(
    @Query('language') language?: string,
    @Query('cefr_level') cefrLevel?: string,
  ) {
    return this.service.getDialogues(language, cefrLevel);
  }

  @Get('dialogues/:id')
  async getDialogueById(@Param('id') id: string) {
    return this.service.getDialogueById(id);
  }

  @Post('dialogues')
  async createDialogue(@Body() dto: CreateDialogueDto) {
    return this.service.createDialogue(dto);
  }
}
