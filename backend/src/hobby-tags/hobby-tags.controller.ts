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

  @Get('my')
  @UseGuards(SupabaseAuthGuard)
  async getMyTags(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.hobbyTagsService.getUserTags(userId);
  }

  @Post('my')
  @UseGuards(SupabaseAuthGuard)
  async addTag(
    @Req() req: Request,
    @Body() body: { hobby_tag_id: string; proficiency_level?: string },
  ) {
    const userId = (req as any).user?.id;
    return this.hobbyTagsService.addUserTag(userId, body.hobby_tag_id, body.proficiency_level);
  }

  @Delete('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  async removeTag(@Req() req: Request, @Param('hobbyTagId') hobbyTagId: string) {
    const userId = (req as any).user?.id;
    await this.hobbyTagsService.removeUserTag(userId, hobbyTagId);
    return { message: 'Hobby tag removed successfully' };
  }

  @Patch('my/:hobbyTagId')
  @UseGuards(SupabaseAuthGuard)
  async updateProficiency(
    @Req() req: Request,
    @Param('hobbyTagId') hobbyTagId: string,
    @Body() body: { proficiency_level: string },
  ) {
    const userId = (req as any).user?.id;
    return this.hobbyTagsService.updateProficiency(userId, hobbyTagId, body.proficiency_level);
  }
}
