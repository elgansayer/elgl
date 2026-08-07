import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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

@Controller('discovery')
@UseGuards(SupabaseAuthGuard, DiscoveryRateLimiterGuard)
@ApiBearerAuth()
@ApiTags('Matchmaking')
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
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Search for language exchange partners',
    description: `Performs a personalised partner search using location-aware spatial queries
(via PostGIS search_nearby_users RPC) with graceful fallback to direct
Supabase queries and mock data.

Supports filters:
- Native language and target language
- Serious-learner mode (auto-enabled when the requesting user has it active)
- Proficiency level
- Gender (VIP users only)
- Age range
- Interests (overlap filter)
- Audio intro availability
- Country and city
- Learning goals and availability windows
- Distance radius (metres)
- Voice room activity

Sort options: best_match | nearest | newest | online_now`,
  })
  @ApiOkResponse({
    description: 'A list of matching user profiles.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async findPartners(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
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
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Get Partner of the Week IDs',
    description: `Returns a list of user IDs selected as Partners of the Week. Refreshed
every Sunday at midnight by a cron job. Results are cached in Redis
with a 7-day TTL and served with public CDN caching headers.

Users qualify based on:
- correction_ratio > 0.5
- Highest correction_ratio and study_streak_days`,
  })
  @ApiOkResponse({
    description: 'A list of user IDs for the current Partners of the Week.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: [
        'a1b2c3d4-0000-4000-8000-000000000001',
        'a1b2c3d4-0000-4000-8000-000000000002',
      ],
    },
  })
  async getPartnerOfWeek(): Promise<string[]> {
    return this.discoveryService.getPartnerOfWeekIds();
  }

  /**
   * Audio intro discovery: user-specific filters, private short cache.
   */
  @Get('audio-intros')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Discover users with audio introductions',
    description: `Returns user profiles that have an audio intro URL set. Applies the same
filter parameters as the partner search, but only returns profiles
with non-null, non-empty audio_intro_url values.`,
  })
  @ApiOkResponse({
    description: 'A list of users with audio introductions.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
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
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Recently joined native speakers',
    description: `Returns users who joined within the last 7 days and have at least one
native language set. Ordered by creation date descending, limited to 10
results. Served with public CDN caching.`,
  })
  @ApiOkResponse({
    description:
      'A list of up to 10 recently joined users with native languages.',
  })
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
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Spotlight users',
    description: `Returns the 5 most recently created users with at least one native
language set. Served with public CDN caching.`,
  })
  @ApiOkResponse({
    description: 'A list of up to 5 spotlight user profiles.',
  })
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
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Find partners by language pair',
    description: `Searches for users whose native and target languages match the specified
pair. Supports pagination with page and limit parameters.

Sort options:
- best_match (default): ranked by study streak and correction ratio
- newest: ordered by creation date`,
  })
  @ApiOkResponse({
    description: 'A paginated list of users matching the language pair.',
  })
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
  @DiscoveryRateLimit({
    freeMaxRequests: 20,
    vipMaxRequests: 80,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Search users by country or city',
    description: `Performs a case-insensitive ILIKE search on the country and/or city
columns. At least one of country or city should be provided.`,
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country name to search for (case-insensitive partial match)',
    example: 'Japan',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'City name to search for (case-insensitive partial match)',
    example: 'Tokyo',
  })
  @ApiOkResponse({
    description: 'A list of users matching the location criteria.',
  })
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
