import {
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CorrectorScoreResult,
  CorrectorScoreService,
} from './corrector-score.service';
import { RateCorrectorDto } from './dto/rate-corrector.dto';

@Controller('corrector-score')
@UseGuards(SupabaseAuthGuard)
export class CorrectorScoreController {
  constructor(private readonly correctorScoreService: CorrectorScoreService) {}

  @Post('rate')
  async rateUser(
    @CurrentUser() user: User | null,
    @Body() dto: RateCorrectorDto,
  ): Promise<{ message: string }> {
    if (!user) throw new UnauthorizedException();
    if (user.id === dto.rated_user_id) {
      throw new ForbiddenException('Cannot rate yourself');
    }
    await this.correctorScoreService.submitRating(
      user.id,
      dto.rated_user_id,
      dto.score,
    );
    return { message: 'Rating submitted' };
  }

  @Get(':userId')
  async getScore(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<CorrectorScoreResult> {
    return this.correctorScoreService.getCorrectorScore(userId);
  }
}
