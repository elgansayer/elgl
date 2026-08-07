import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
  ApiQuery,
} from '@nestjs/swagger';
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
import { sanitiseDiscoveryData } from './sanitise-discovery.helper';

@ApiTags('Discovery Map')
@ApiTags('Discovery - Partners')
@ApiTags('Discovery - Audio Intros')
@ApiTags('Discovery - Language Pair')
@ApiTags('Discovery - Location')
@ApiBearerAuth('bearer')
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
  @ApiOperation({
    summary: 'Find language partners',
    description:
      'Returns a list of language partners personalised to the authenticated user. ' +
      'Supports filtering by native/target languages, proficiency level, interests, ' +
      'serious learner status, age range, country, city, and proximity (PostGIS geolocation). ' +
      'VIP users can spoof their location and apply additional gender filtering. ' +
      'Results are sorted by relevance and enriched with Partner of the Week flags.',
  })
  @ApiOkResponse({
    description: 'List of user profiles matching partner criteria.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', description: 'User display name' },
          native_languages: { type: 'array', items: { type: 'string' }, description: 'Native language ISO codes' },
          target_languages: { type: 'array', items: { type: 'string' }, description: 'Target language ISO codes' },
          bio_text: { type: 'string', nullable: true, description: 'User biography' },
          avatar_url: { type: 'string', nullable: true, description: 'Avatar image URL' },
          audio_intro_url: { type: 'string', nullable: true, description: 'Audio introduction URL' },
          is_vip: { type: 'boolean', description: 'VIP subscription status' },
          study_streak_days: { type: 'number', description: 'Consecutive study days' },
          correction_ratio: { type: 'number', description: 'Ratio of corrections contributed' },
          is_serious_learner: { type: 'boolean', description: 'Serious learner flag' },
          is_partner_of_week: { type: 'boolean', description: 'Partner of the Week flag' },
          distance_metres: { type: 'number', nullable: true, description: 'Distance in metres (when using geospatial search)' },
          proficiency_level: { type: 'string', nullable: true, description: 'Self-assessed proficiency level' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 30/min, VIP: 120/min.' })
  @ApiQuery({ name: 'latitude', required: false, type: Number, description: 'GPS latitude for geospatial proximity search (-90 to 90)' })
  @ApiQuery({ name: 'longitude', required: false, type: Number, description: 'GPS longitude for geospatial proximity search (-180 to 180)' })
  @ApiQuery({ name: 'radius_metres', required: false, type: Number, description: 'Proximity search radius in metres (default 50000, range 1000-20000000)' })
  @ApiQuery({ name: 'native_languages', required: false, type: String, description: 'Required native language of partner (ISO code)' })
  @ApiQuery({ name: 'target_language', required: false, type: String, description: 'Required target language of partner (ISO code)' })
  @ApiQuery({ name: 'serious_learner_only', required: false, type: Boolean, description: 'Filter to serious learners only (streak > 7 days, correction ratio >= 0.8)' })
  @ApiQuery({ name: 'level', required: false, type: String, description: 'Filter by proficiency level' })
  @ApiQuery({ name: 'gender', required: false, type: String, description: 'Filter by gender (VIP only)' })
  @ApiQuery({ name: 'interests', required: false, type: String, description: 'Filter by shared interests' })
  @ApiQuery({ name: 'age_min', required: false, type: Number, description: 'Minimum age filter (1-120)' })
  @ApiQuery({ name: 'age_max', required: false, type: Number, description: 'Maximum age filter (1-120)' })
  @ApiQuery({ name: 'voice_room_active', required: false, type: Boolean, description: 'Filter to users currently in an audio room' })
  @ApiQuery({ name: 'has_audio_intro', required: false, type: Boolean, description: 'Filter to users who have recorded an audio introduction' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort order for results' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter by country name (fuzzy match)' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city name (fuzzy match)' })
  @ApiQuery({ name: 'learning_goals', required: false, type: String, description: 'Filter by learning goals' })
  @ApiQuery({ name: 'learning_goals_mode', required: false, type: String, description: 'Learning goals matching mode' })
  @ApiQuery({ name: 'availability_morning', required: false, type: Boolean, description: 'Filter by morning availability' })
  @ApiQuery({ name: 'availability_afternoon', required: false, type: Boolean, description: 'Filter by afternoon availability' })
  @ApiQuery({ name: 'availability_evening', required: false, type: Boolean, description: 'Filter by evening availability' })
  @ApiQuery({ name: 'available_time_start', required: false, type: String, description: 'Available time start (HH:mm format)' })
  @ApiQuery({ name: 'available_time_end', required: false, type: String, description: 'Available time end (HH:mm format)' })
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
    return sanitiseDiscoveryData(
      await this.discoveryService.searchPartners(user.id, profile, query),
    );
  }

  /**
   * Partner of the Week: refreshed weekly by cron, public long-lived CDN cache.
   */
  @Get('partner-of-week')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_LONG))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Get Partner of the Week',
    description:
      'Returns the list of user IDs selected as Partners of the Week. ' +
      'Computed weekly via cron job based on correction ratio and study streak days. ' +
      'Cached aggressively for browser (1 hour) and CDN (24 hours) with stale-while-revalidate.',
  })
  @ApiOkResponse({
    description: 'Array of user IDs selected as Partners of the Week.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['uuid-1', 'uuid-2', 'uuid-3'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 60/min, VIP: 300/min.' })
  async getPartnerOfWeek(): Promise<string[]> {
    return this.discoveryService.getPartnerOfWeekIds();
  }

  /**
   * Audio intro discovery: user-specific filters, private short cache.
   */
  @Get('audio-intros')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Discover audio introductions',
    description:
      'Returns user profiles with recorded audio introductions matching the authenticated user\'s language preferences. ' +
      'Supports the same filter parameters as the partners endpoint. ' +
      'Results are private short-cached and rate-limited.',
  })
  @ApiOkResponse({
    description: 'List of user profiles with audio introductions.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 30/min, VIP: 120/min.' })
  async getAudioIntros(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    const result = await this.discoveryService.getAudioIntros(user.id, profile, query);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Recently joined native speakers: shared list, public short-lived CDN cache.
   */
  @Get('recent-native-speakers')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Get recently joined native speakers',
    description:
      'Returns a list of recently joined native speaker profiles. ' +
      'This is a shared list cached briefly for performance (60s browser, 5min CDN).',
  })
  @ApiOkResponse({
    description: 'List of recently joined native speaker profiles.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 60/min, VIP: 300/min.' })
  async getRecentNativeSpeakers(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.getRecentNativeSpeakers(user.id);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Spotlight users: shared list, public short-lived CDN cache.
   */
  @Get('spotlight')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PUBLIC_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Get spotlight users',
    description:
      'Returns a curated list of spotlight user profiles. ' +
      'Spotlight users are selected based on engagement and quality signals. ' +
      'Cached briefly for performance (60s browser, 5min CDN).',
  })
  @ApiOkResponse({
    description: 'List of spotlight user profiles.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 60/min, VIP: 300/min.' })
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.getSpotlightUsers(user.id);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Language pair matching: user-specific, private short cache.
   */
  @Get('language-pair')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Find users by language pair',
    description:
      'Returns user profiles matching a specific native-to-target language pair. ' +
      'Supports pagination (page, limit), sorting, and optional filters for proficiency level, ' +
      'audio intros, country/city, learning goals, availability, and voice room activity.',
  })
  @ApiOkResponse({
    description: 'List of user profiles matching the language pair criteria.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 30/min, VIP: 120/min.' })
  @ApiQuery({ name: 'native_language', required: false, type: String, description: 'Native language ISO code' })
  @ApiQuery({ name: 'target_language', required: false, type: String, description: 'Target language ISO code' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Zero-based page number (default 0)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default 50, min 1)' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort order (e.g. best_match, newest). Default: best_match' })
  @ApiQuery({ name: 'level', required: false, type: String, description: 'Filter by proficiency level' })
  @ApiQuery({ name: 'has_audio_intro', required: false, type: Boolean, description: 'Filter to users with audio introductions' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filter by country name' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city name' })
  @ApiQuery({ name: 'learning_goals', required: false, type: String, description: 'Filter by learning goals' })
  @ApiQuery({ name: 'learning_goals_mode', required: false, type: String, description: 'Learning goals matching mode' })
  @ApiQuery({ name: 'availability_morning', required: false, type: Boolean, description: 'Filter by morning availability' })
  @ApiQuery({ name: 'availability_afternoon', required: false, type: Boolean, description: 'Filter by afternoon availability' })
  @ApiQuery({ name: 'availability_evening', required: false, type: Boolean, description: 'Filter by evening availability' })
  @ApiQuery({ name: 'voice_room_active', required: false, type: Boolean, description: 'Filter to users currently in an audio room' })
  async findByLanguagePair(
    @CurrentUser() user: User | null,
    @Query() query: LanguagePairQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.findByLanguagePair(user.id, query);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Location-based search: user-specific, private short cache.
   */
  @Get('search-by-location')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({ freeMaxRequests: 20, vipMaxRequests: 80, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Search users by country and/or city',
    description:
      'Returns user profiles filtered by country and/or city using fuzzy matching (ILIKE). ' +
      'Results are private short-cached and rate-limited.',
  })
  @ApiOkResponse({
    description: 'List of user profiles in the specified country/city.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded. Free: 20/min, VIP: 80/min.' })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Country name (fuzzy match, e.g. "Japan")' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'City name (fuzzy match, e.g. "Tokyo")' })
  async searchByLocation(
    @CurrentUser() user: User | null,
    @Query('country') country?: string,
    @Query('city') city?: string,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.searchByCountryCity(user.id, {
      country,
      city,
    });
    return sanitiseDiscoveryData(result);
  }
}
