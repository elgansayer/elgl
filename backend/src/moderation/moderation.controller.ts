import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ModerationItem, ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';

@Controller('moderation')
@UseGuards(SupabaseAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('items')
  async getItems(
    @Query('type') type: 'moment' | 'profile',
    @Query('status') status?: string,
  ): Promise<ModerationItem[]> {
    const items = await this.moderationService.getItems(type, status);
    if (!items.length) {
      throw new NotFoundException('No moderation items found.');
    }
    return items;
  }

  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  async reportUser(
    @Req() req: { user: { id: string } },
    @Body() dto: ReportUserDto,
  ) {
    return this.moderationService.reportUser(req.user.id, dto);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Body() dto: ModerationActionDto) {
    return this.moderationService.approveItem(dto);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Body() dto: ModerationActionDto) {
    return this.moderationService.rejectItem(dto);
  }

  @Get('analyse/:userId')
  async analyseUser(@Param('userId') userId: string) {
    return this.moderationService.analyseUserForDatingBehaviour(userId);
  }
}
