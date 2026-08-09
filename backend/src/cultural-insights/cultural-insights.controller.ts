import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CulturalInsightsService } from './cultural-insights.service';
import { CreateCulturalTagDto } from './dto/create-cultural-tag.dto';
import { CulturalTagFilterDto } from './dto/cultural-tag-filter.dto';

@Controller('cultural-insights')
export class CulturalInsightsController {
  constructor(private readonly service: CulturalInsightsService) {}

  @Post('tags')
  async createTag(@Body() dto: CreateCulturalTagDto) {
    return this.service.createTag(dto.momentId, dto.tagName);
  }

  @Get('tags/:momentId')
  async getTagsForMoment(@Param('momentId') momentId: string) {
    return this.service.getTagsForMoment(momentId);
  }

  @Get('moments')
  async searchByTags(@Query() filter: CulturalTagFilterDto) {
    const tags = filter.tags ? filter.tags.split(',') : [];
    return this.service.searchMomentsByTags(tags);
  }
}
