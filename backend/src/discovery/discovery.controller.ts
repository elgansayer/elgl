import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { UsersService } from '../users/users.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { DiscoveryService } from './discovery.service';
import {
  DiscoveryCacheInterceptor,
  DISCOVERY_CACHE_PUBLIC_LONG,
  DISCOVERY_CACHE_PUBLIC_SHORT,
  DISCOVERY_CACHE_PRIVATE_SHORT,
} from './cache.interceptor';
import {
  DiscoveryRateLimiterGuard,
  DiscoveryRateLimit,
} from './discovery-rate-limiter.guard';

@Controller('discovery')
@UseGuards(SupabaseAuthGuard, DiscoveryRateLimiterGuard)
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Personalised partner search: user-specific filters, private short cache.
   */
  @Get('partners')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
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

  /**
   * Partner of the Week: refreshed weekly by cron, public long-lived CDN cache.
   */
  @Get('partner-of-week')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  async getPartnerOfWeek(): Promise<string[]> {
    return this.discoveryService.getPartnerOfWeekIds();
  }

  /**
   * Audio intro discovery: user-specific filters, private short cache.
   */
  @Get('audio-intros')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
  async getAudioIntros(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    return this.discoveryService.getAudioIntros(user.id, profile, query);
  }

  /**
   * Recently joined native speakers: shared list, public short-lived CDN cache.
   */
  @Get('recent-native-speakers')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  async getRecentNativeSpeakers(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.getRecentNativeSpeakers(user.id);
  }

  /**
   * Spotlight users: shared list, public short-lived CDN cache.
   */
  @Get('spotlight')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.getSpotlightUsers(user.id);
  }

  /**
   * Language pair matching: user-specific, private short cache.
   */
  @Get('language-pair')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
  async findByLanguagePair(
    @CurrentUser() user: User | null,
    @Query() query: LanguagePairQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.findByLanguagePair(user.id, query);
  }

  /**
   * Location-based search: user-specific, private short cache.
   */
  @Get('search-by-location')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 20, vipMaxRequests: 80, windowSeconds: 60 })
  async searchByLocation(
    @CurrentUser() user: User | null,
    @Query('country') country?: string,
    @Query('city') city?: string,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.searchByCountryCity(user.id, {
      country,
      city,
    });
  }
}
