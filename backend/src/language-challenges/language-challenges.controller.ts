import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LanguageChallengesService } from './language-challenges.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ListChallengesQueryDto } from './dto/list-challenges-query.dto';

interface AuthUser {
  id: string;
}

@Controller('language-challenges')
@UseGuards(SupabaseAuthGuard)
export class LanguageChallengesController {
  constructor(private readonly challengesService: LanguageChallengesService) {}

  @Post()
  create(@Body() dto: CreateChallengeDto, @CurrentUser() user: AuthUser) {
    return this.challengesService.createChallenge(user.id, dto);
  }

  @Get()
  list(
    @Query() query: ListChallengesQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.challengesService.listChallenges(user.id, query.limit, query.offset);
  }

  @Post(':id/join')
  join(
    @Param('id', new ParseUUIDPipe()) challengeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.challengesService.joinChallenge(user.id, challengeId);
  }

  @Post(':id/daily-checkin')
  dailyCheckin(
    @Param('id', new ParseUUIDPipe()) challengeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.challengesService.dailyCheckin(user.id, challengeId);
  }

  @Post(':id/claim')
  claim(
    @Param('id', new ParseUUIDPipe()) challengeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.challengesService.claimPrize(user.id, challengeId);
  }
}
