import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';
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

@ApiTags('Discovery')
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
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Find language exchange partners',
    description:
      'Returns a personalised list of potential language exchange partners based on the authenticated user\'s profile and specified filters. Supports geo-spatial proximity search, language pair matching, serious learner filtering, availability overlap, and VIP-only features such as gender filtering and location spoofing. Results are privately cached per user for 30 seconds.',
  })
  @ApiOkResponse({
    description: 'Array of matching user profiles returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true, description: 'User display name' },
          native_languages: { type: 'array', items: { type: 'string' }, description: 'Native languages (ISO 639-1 codes)' },
          target_languages: { type: 'array', items: { type: 'string' }, description: 'Target languages the user is learning' },
          bio_text: { type: 'string', nullable: true, description: 'User bio' },
          avatar_url: { type: 'string', nullable: true, description: 'Avatar image URL' },
          audio_intro_url: { type: 'string', nullable: true, description: 'Audio introduction URL' },
          is_vip: { type: 'boolean', description: 'VIP status' },
          study_streak_days: { type: 'number', description: 'Consecutive study streak days' },
          correction_ratio: { type: 'number', description: 'Ratio of corrections given vs received' },
          is_serious_learner: { type: 'boolean', description: 'Whether the user is a serious learner' },
          proficiency_level: { type: 'string', nullable: true, description: 'Self-assessed proficiency level' },
          is_partner_of_week: { type: 'boolean', description: 'Whether this user is a Partner of the Week' },
          distance_metres: { type: 'number', nullable: true, description: 'Distance in metres from search coordinates' },
          country: { type: 'string', nullable: true },
          city: { type: 'string', nullable: true },
          interests: { type: 'array', items: { type: 'string' }, nullable: true },
          learning_goals: { type: 'array', items: { type: 'string' }, nullable: true },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
>>>>>>> origin/main
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
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Get Partner of the Week IDs',
    description:
      'Returns the list of user IDs selected as Partners of the Week. This list is recalculated every Sunday at midnight (UTC) by a cron job that selects the top 10 users sorted by correction ratio and study streak. Results are publicly cached at the CDN edge for up to 24 hours.',
  })
  @ApiOkResponse({
    description: 'Array of Partner of the Week user IDs',
    schema: {
      type: 'array',
      items: { type: 'string', description: 'User UUID' },
      example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
>>>>>>> origin/main
  async getPartnerOfWeek(): Promise<string[]> {
    return this.discoveryService.getPartnerOfWeekIds();
  }

  /**
   * Audio intro discovery: user-specific filters, private short cache.
   */
  @Get('audio-intros')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Discover audio introductions',
    description:
      'Returns a personalised list of users who have recorded audio introductions, filtered by the same criteria as the partner search endpoint. Useful for browsing voice samples to find conversation partners. Results are privately cached per user for 30 seconds.',
  })
  @ApiOkResponse({
    description: 'Array of user profiles with audio introductions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true },
          native_languages: { type: 'array', items: { type: 'string' } },
          target_languages: { type: 'array', items: { type: 'string' } },
          bio_text: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          audio_intro_url: { type: 'string', nullable: true },
          is_vip: { type: 'boolean' },
          study_streak_days: { type: 'number' },
          correction_ratio: { type: 'number' },
          is_serious_learner: { type: 'boolean' },
          proficiency_level: { type: 'string', nullable: true },
          is_partner_of_week: { type: 'boolean' },
          distance_metres: { type: 'number', nullable: true },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
>>>>>>> origin/main
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
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Get recently joined native speakers',
    description:
      'Returns a shared list of native speakers who recently joined the platform. This list is the same for all users and is publicly cached at the CDN edge for up to 10 minutes.',
  })
  @ApiOkResponse({
    description: 'Array of recently joined native speaker profiles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true },
          native_languages: { type: 'array', items: { type: 'string' } },
          target_languages: { type: 'array', items: { type: 'string' } },
          bio_text: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          is_vip: { type: 'boolean' },
          study_streak_days: { type: 'number' },
          correction_ratio: { type: 'number' },
          is_serious_learner: { type: 'boolean' },
          proficiency_level: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
>>>>>>> origin/main
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
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Get spotlighted users',
    description:
      'Returns a curated list of spotlighted/featured users. This is a shared list that is the same for all users and is publicly cached at the CDN edge for up to 10 minutes.',
  })
  @ApiOkResponse({
    description: 'Array of spotlighted user profiles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true },
          native_languages: { type: 'array', items: { type: 'string' } },
          target_languages: { type: 'array', items: { type: 'string' } },
          bio_text: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          is_vip: { type: 'boolean' },
          study_streak_days: { type: 'number' },
          correction_ratio: { type: 'number' },
          is_serious_learner: { type: 'boolean' },
          proficiency_level: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 60, vipMaxRequests: 300, windowSeconds: 60 })
>>>>>>> origin/main
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    if (!user) return [];
    return this.discoveryService.getSpotlightUsers(user.id);
  }

  /**
   * Language pair matching: user-specific, private short cache.
   */
  @Get('language-pair')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_PRIVATE_SHORT))
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Find partners by language pair',
    description:
      'Returns a list of users matching a specific language pair, with pagination support. Searches for users whose native language matches the requested target language and whose target language matches the requested native language (i.e., complementary language exchange partners). Results are privately cached per user for 30 seconds.',
  })
  @ApiOkResponse({
    description: 'Paginated array of matching user profiles',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true },
          native_languages: { type: 'array', items: { type: 'string' } },
          target_languages: { type: 'array', items: { type: 'string' } },
          bio_text: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          is_vip: { type: 'boolean' },
          study_streak_days: { type: 'number' },
          correction_ratio: { type: 'number' },
          is_serious_learner: { type: 'boolean' },
          proficiency_level: { type: 'string', nullable: true },
          is_partner_of_week: { type: 'boolean' },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 30, vipMaxRequests: 120, windowSeconds: 60 })
>>>>>>> origin/main
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
<<<<<<< HEAD
  @ApiOperation({
    summary: 'Search partners by country or city',
    description:
      'Returns a list of users filtered by country and/or city name using case-insensitive substring matching. Results are privately cached per user for 30 seconds.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country name filter (case-insensitive ILIKE)',
    example: 'Japan',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'City name filter (case-insensitive ILIKE)',
    example: 'Tokyo',
  })
  @ApiOkResponse({
    description: 'Array of user profiles matching the location criteria',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique user identifier (UUID)' },
          display_name: { type: 'string', nullable: true },
          native_languages: { type: 'array', items: { type: 'string' } },
          target_languages: { type: 'array', items: { type: 'string' } },
          bio_text: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          audio_intro_url: { type: 'string', nullable: true },
          is_vip: { type: 'boolean' },
          study_streak_days: { type: 'number' },
          correction_ratio: { type: 'number' },
          is_serious_learner: { type: 'boolean' },
          proficiency_level: { type: 'string', nullable: true },
          last_active_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
=======
  @DiscoveryRateLimit({ freeMaxRequests: 20, vipMaxRequests: 80, windowSeconds: 60 })
>>>>>>> origin/main
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
