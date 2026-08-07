import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { HobbyTagsService } from './hobby-tags.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { Request } from 'express';

@Controller('hobby-tags')
export class HobbyTagsController {
  constructor(private readonly hobbyTagsService: HobbyTagsService) {}

  @Get()
  async getAllTags() {
    return this.hobbyTagsService.getAllTags();
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async createGlobalTag(
    @Body() body: { name: string; category: string; icon?: string },
  ): Promise<any> {
    return this.hobbyTagsService.createTag(body.name, body.category, body.icon);
  }

  @Get('my')
  @UseGuards(SupabaseAuthGuard)
  async getMyTags(@Req() req: { user?: { id: string } }): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.getUserTags(userId as string);
  }

  @Post('my')
  @UseGuards(SupabaseAuthGuard)
  async addTag(
    @Req() req: { user?: { id: string } },
    @Body() body: { hobby_tag_id: string; proficiency_level?: number },
  ): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.addUserTag(
      userId as string,
      body.hobby_tag_id,
      body.proficiency_level,
    );
  }

  @Delete('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  async removeTag(
    @Req() req: { user?: { id: string } },
    @Param('hobbyTagId') hobbyTagId: string,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    await this.hobbyTagsService.removeUserTag(userId as string, hobbyTagId);
    return { message: 'Hobby tag removed successfully' };
  }

  @Patch('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  async updateProficiency(
    @Req() req: { user?: { id: string } },
    @Param('hobbyTagId') hobbyTagId: string,
    @Body() body: { proficiency_level: number },
  ): Promise<unknown> {
    const userId = req.user?.id;
    return this.hobbyTagsService.updateProficiency(
      userId as string,
      hobbyTagId,
      body.proficiency_level,
    );
  }
}
