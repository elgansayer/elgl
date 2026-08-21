import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CorrectorScoreService } from './corrector-score.service';
import { RateCorrectorDto } from './dto/rate-corrector.dto';

@Controller('corrector-score')
@UseGuards(SupabaseAuthGuard)
export class CorrectorScoreController {
  constructor(private readonly correctorScoreService: CorrectorScoreService) {}

  @Post('rate')
  async rateUser(
    @CurrentUser() user: any,
    @Body() dto: RateCorrectorDto,
  ): Promise<{ message: string }> {
    if (!user) throw new UnauthorizedException();
    if (user.id === dto.rated_user_id) {
      throw new UnauthorizedException('Cannot rate yourself');
    }
    await this.correctorScoreService.submitRating(
      user.id,
      dto.rated_user_id,
      dto.score,
    );
    return { message: 'Rating submitted' };
  }

  @Get(':userId')
  async getScore(@Param('userId') userId: string) {
    return this.correctorScoreService.getCorrectorScore(userId);
  }
}
