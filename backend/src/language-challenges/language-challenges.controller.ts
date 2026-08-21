import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LanguageChallengesService } from './language-challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { JoinChallengeDto } from './dto/join-challenge.dto';
import { ClaimPrizeDto } from './dto/claim-prize.dto';

@Controller('language-challenges')
export class LanguageChallengesController {
  constructor(private readonly challengesService: LanguageChallengesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(@Body() dto: CreateChallengeDto, @Req() req: any) {
    const userId = req.user.id;
    return this.challengesService.createChallenge(userId, dto);
  }

  @Get()
  async list() {
    return this.challengesService.listChallenges();
  }

  @Post(':id/join')
  @UseGuards(SupabaseAuthGuard)
  async join(
    @Param('id') challengeId: string,
    @Body() _dto: JoinChallengeDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.challengesService.joinChallenge(userId, challengeId);
  }

  @Post(':id/daily-checkin')
  @UseGuards(SupabaseAuthGuard)
  async dailyCheckin(@Param('id') challengeId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.challengesService.dailyCheckin(userId, challengeId);
  }

  @Post(':id/claim')
  @UseGuards(SupabaseAuthGuard)
  async claim(
    @Param('id') challengeId: string,
    @Body() _dto: ClaimPrizeDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.challengesService.claimPrize(userId, challengeId);
  }
}
