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
import { MetricsService } from '../metrics/metrics.service';
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
    private readonly metricsService: MetricsService,
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
    const startTime = Date.now();
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    // If the authenticated user has serious_learner_mode enabled,
    // automatically set the serious_learner_mode flag in the query
    if (profile?.is_serious_learner === true) {
      query.serious_learner_mode = true;
    }
    const hasLocation = query.latitude !== undefined && query.longitude !== undefined;
    const results = await this.discoveryService.searchPartners(user.id, profile, query);
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordDiscoverySearch('partners', hasLocation, duration, results.length);
    return results;
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
    const startTime = Date.now();
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    const results = await this.discoveryService.getAudioIntros(user.id, profile, query);
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordDiscoveryAudioIntroRequest();
    this.metricsService.recordDiscoverySearch('audio-intros', false, duration, results.length);
    return results;
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
    const startTime = Date.now();
    if (!user) return [];
    const results = await this.discoveryService.getRecentNativeSpeakers(user.id);
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordDiscoveryRecentNativeSpeakerRequest();
    this.metricsService.recordDiscoverySearch('recent-native-speakers', false, duration, results.length);
    return results;
  }

  /**
   * Spotlight users: shared list, public short-lived CDN cache.
   */
  @Get('spotlight')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    const startTime = Date.now();
    if (!user) return [];
    const results = await this.discoveryService.getSpotlightUsers(user.id);
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordDiscoverySpotlightRequest();
    this.metricsService.recordDiscoverySearch('spotlight', false, duration, results.length);
    return results;
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
    const startTime = Date.now();
    if (!user) return [];
    const results = await this.discoveryService.findByLanguagePair(user.id, query);
    const duration = (Date.now() - startTime) / 1000;
    this.metricsService.recordDiscoveryLanguagePairRequest();
    this.metricsService.recordDiscoverySearch('language-pair', false, duration, results.length);
    return results;
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
    const startTime = Date.now();
    if (!user) return [];
    const results = await this.discoveryService.searchByCountryCity(user.id, {
      country,
      city,
    });
    const duration = (Date.now() - startTime) / 1000;
    const hasCountry = !!country;
    const hasCity = !!city;
    this.metricsService.recordDiscoveryLocationSearchRequest(hasCountry, hasCity);
    this.metricsService.recordDiscoverySearch('search-by-location', false, duration, results.length);
    return results;
  }
}
