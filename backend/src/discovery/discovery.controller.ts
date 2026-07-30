import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { UsersService } from '../users/users.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { DiscoveryService } from './discovery.service';

@Controller('discovery')
@UseGuards(SupabaseAuthGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly usersService: UsersService,
  ) {}

  @Get('partners')
  async findPartners(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    // If the authenticated user has serious_learner_mode enabled,
    // automatically set the serious_learner_mode flag in the query
    if (profile?.is_serious_learner === true) {
      query.serious_learner_mode = true;
    }
    return this.discoveryService.searchPartners(user.id, profile, query);
  }

  @Get('partner-of-week')
  async getPartnerOfWeek(): Promise<string[]> {
    return this.discoveryService.getPartnerOfWeekIds();
  }

  @Get('audio-intros')
  async getAudioIntros(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    return this.discoveryService.getAudioIntros(user.id, profile, query);
  }

  @Get('recent-native-speakers')
  async getRecentNativeSpeakers(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.getRecentNativeSpeakers(user.id);
  }

  @Get('spotlight')
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.getSpotlightUsers(user.id);
  }

  @Get('language-pair')
  async findByLanguagePair(
    @CurrentUser() user: User | null,
    @Query() query: LanguagePairQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.findByLanguagePair(user.id, query);
  }
}
