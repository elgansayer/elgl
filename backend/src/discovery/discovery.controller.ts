import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { UsersService } from '../users/users.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { DiscoveryService, DiscoveryResult } from './discovery.service';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import {
  DiscoveryCacheInterceptor,
  DISCOVERY_CACHE_NO_STORE,
} from './cache.interceptor';
import {
  DiscoveryRateLimiterGuard,
  DiscoveryRateLimit,
} from './discovery-rate-limiter.guard';
import { sanitiseDiscoveryData } from './sanitise-discovery.helper';

const userProfileSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789' },
      display_name: { type: 'string', nullable: true, example: 'Taro Yamada' },
      avatar_url: {
        type: 'string',
        nullable: true,
        example: 'https://r2.example.com/avatars/taro.jpg',
      },
      native_languages: {
        type: 'array',
        items: { type: 'string' },
        example: ['ja-JP'],
      },
      target_languages: {
        type: 'array',
        items: { type: 'string' },
        example: ['en', 'ko'],
      },
      bio_text: {
        type: 'string',
        nullable: true,
        example: 'Hello! I want to practise English.',
      },
      audio_intro_url: {
        type: 'string',
        nullable: true,
        example: 'https://r2.example.com/audio/taro.mp3',
      },
      is_vip: { type: 'boolean', example: false },
      is_serious_learner: { type: 'boolean', example: true },
      study_streak_days: { type: 'number', example: 30 },
      correction_ratio: { type: 'number', example: 0.95 },
      is_partner_of_week: { type: 'boolean', example: false },
      distance_metres: { type: 'number', nullable: true, example: 1500 },
      proficiency_level: { type: 'string', nullable: true, example: 'B1' },
    },
  },
};

@ApiTags('Matchmaking & Discovery')
@Controller('discovery')
@UseGuards(SupabaseAuthGuard, DiscoveryRateLimiterGuard)
@ApiBearerAuth()
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly usersService: UsersService,
    private readonly degradationService: DiscoveryDegradationService,
  ) {}

  /**
   * Personalised partner search: user-specific filters, never HTTP cached.
   */
  @Get('partners')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Search for language exchange partners',
    description:
      'Personalised partner search with extensive filtering options. ' +
      'Supports location-based proximity queries via PostGIS ST_DWithin, ' +
      'language pair matching, serious learner filtering, interest overlap, ' +
      'age range, gender (VIP only), country/city, availability, and audio room active filters. ' +
      'Results are sorted by the specified sort parameter and enriched with Partner of the Week flags. ' +
      'VIP users benefit from location and country/city spoofing via mock_location and mock_country/mock_city profile fields.',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered list of user profiles matching the search criteria.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async findPartners(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    if (profile?.is_serious_learner === true) {
      query.serious_learner_mode = true;
    }
    if (query.serious_learner_mode === true) {
      query.serious_learner_only = true;
    }
    const result = await this.discoveryService.searchPartnersWithDegradation(
      user.id,
      profile,
      query,
    );
    return result.data;
  }

  /**
   * Partner of the Week: refreshed weekly by cron and revalidated on read.
   */
  @Get('partner-of-week')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Get Partner of the Week user IDs',
    description:
      'Returns the current Partner of the Week user IDs, computed weekly by a cron job (Sundays at midnight). ' +
      'Partners are selected from top users with correction_ratio > 0.5, ordered by correction_ratio and study_streak_days. ' +
      'Candidate IDs are cached in Redis for 7 days and revalidated against current privacy, deletion, and viewer block state on every read.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of up to 10 Partner of the Week user IDs.',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['uuid-1', 'uuid-2'],
    },
  })
  async getPartnerOfWeek(@CurrentUser() user: User | null): Promise<string[]> {
    if (!user) return [];
    return this.discoveryService.getPartnerOfWeekIds(user.id);
  }

  /**
   * Audio intro discovery: user-specific filters, never HTTP cached.
   */
  @Get('audio-intros')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Discover partners with audio introductions',
    description:
      'Returns partners filtered by the same SearchQueryDto parameters, additionally filtered to only include users who have uploaded an audio introduction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered list of user profiles with audio introductions.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  @ApiResponse({
    status: 503,
    description: 'Audio introduction discovery is temporarily unavailable.',
  })
  async getAudioIntros(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    if (profile?.is_serious_learner === true) {
      query.serious_learner_mode = true;
    }
    if (query.serious_learner_mode === true) {
      query.serious_learner_only = true;
    }
    const result = await this.discoveryService.getAudioIntros(
      user.id,
      profile,
      query,
    );
    return sanitiseDiscoveryData(result);
  }

  /**
   * Recently joined native speakers: viewer-specific and never HTTP cached.
   */
  @Get('recent-native-speakers')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Get recently joined native speakers',
    description:
      'Returns up to 10 users who joined within the last 7 days and have at least one native language set. ' +
      'Results exclude the requester and blocked profiles, are not HTTP cached so privacy transitions take effect immediately, and are enriched with Partner of the Week flags.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recently joined native speakers.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async getRecentNativeSpeakers(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.getRecentNativeSpeakers(user.id);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Spotlight users: viewer-specific and never HTTP cached.
   */
  @Get('spotlight')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 60,
    vipMaxRequests: 300,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Get spotlight users',
    description:
      'Returns up to 5 recently created users with native languages set. ' +
      'Results exclude the requester and blocked profiles, are not HTTP cached so privacy transitions take effect immediately, and are enriched with Partner of the Week flags.',
  })
  @ApiResponse({
    status: 200,
    description: 'Spotlight user profiles.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async getSpotlight(@CurrentUser() user: User | null): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.getSpotlightUsers(user.id);
    return sanitiseDiscoveryData(result);
  }

  /**
   * Language pair matching: user-specific and never HTTP cached.
   */
  @Get('language-pair')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 30,
    vipMaxRequests: 120,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Find partners by language pair',
    description:
      'Search for partners matching a specific language pair. ' +
      'When both native_language and target_language are provided, returns reciprocal language exchange partners. ' +
      'Supports cursor pagination (page/limit), sort ordering (best_match/newest), and additional filters for level, audio intro, country, city, learning goals, availability, and voice room activity. ' +
      'Results are enriched with Partner of the Week flags and promoted in best_match sort order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated, filtered list of language pair matches.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
  })
  async findByLanguagePair(
    @CurrentUser() user: User | null,
    @Query() query: LanguagePairQueryDto,
  ): Promise<UserProfile[]> {
    if (!user) return [];
    const result = await this.discoveryService.findByLanguagePair(
      user.id,
      query,
    );
    return sanitiseDiscoveryData(result);
  }

  /**
   * Location-based search: user-specific and never HTTP cached.
   */
  @Get('search-by-location')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  @DiscoveryRateLimit({
    freeMaxRequests: 20,
    vipMaxRequests: 80,
    windowSeconds: 60,
  })
  @ApiOperation({
    summary: 'Search partners by country and/or city',
    description:
      'Simple location-based search by country and/or city using case-insensitive ILIKE matching. ' +
      'Returns up to 50 matching user profiles.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country name (case-insensitive partial match).',
    example: 'Japan',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'City name (case-insensitive partial match).',
    example: 'Tokyo',
  })
  @ApiResponse({
    status: 200,
    description: 'User profiles matching the location filter.',
    schema: userProfileSchema,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT.',
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

  /**
   * Degradation status endpoint: returns current circuit breaker states
   * and recent degradation events for monitoring.
   */
  @Get('degradation-status')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  async getDegradationStatus(): Promise<{
    breakers: Record<string, unknown>;
    events: unknown[];
  }> {
    const breakers = this.degradationService.getAllBreakerStates();
    const events = await this.degradationService.getRecentDegradationEvents();
    return {
      breakers: Object.fromEntries(breakers),
      events,
    };
  }

  /**
   * Degradation-aware partner search: returns both data and degradation marker.
   */
  @Get('partners-with-degradation')
  @UseInterceptors(new DiscoveryCacheInterceptor(DISCOVERY_CACHE_NO_STORE))
  async findPartnersWithDegradation(
    @CurrentUser() user: User | null,
    @Query() query: SearchQueryDto,
  ): Promise<DiscoveryResult> {
    if (!user) {
      return {
        data: [],
        marker: { degraded: false, fallbackSource: 'none' },
      };
    }
    const profile = await this.usersService.getProfile(user.id);
    if (profile?.is_serious_learner === true) {
      query.serious_learner_mode = true;
    }
    if (query.serious_learner_mode === true) {
      query.serious_learner_only = true;
    }
    return this.discoveryService.searchPartnersWithDegradation(
      user.id,
      profile,
      query,
    );
  }
}
