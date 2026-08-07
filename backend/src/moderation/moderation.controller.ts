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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ModerationItemsResult, ModerationService } from './moderation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { ModerationQueryDto } from './dto/moderation-query.dto';

@Controller('moderation')
@UseGuards(SupabaseAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('items')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getItems(
    @Query() query: ModerationQueryDto,
  ): Promise<ModerationItemsResult> {
    return this.moderationService.getItems(query);
  }

  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reportUser(
    @Req() req: { user: { id: string } },
    @Body() dto: ReportUserDto,
  ) {
    return this.moderationService.reportUser(req.user.id, dto);
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async approve(@Body() dto: ModerationActionDto) {
    return this.moderationService.approveItem(dto);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async reject(@Body() dto: ModerationActionDto) {
    return this.moderationService.rejectItem(dto);
  }

  @Get('analyse/:userId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async analyseUser(@Param('userId') userId: string) {
    return this.moderationService.analyseUserForDatingBehaviour(userId);
  }
}
