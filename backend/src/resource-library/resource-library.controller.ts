import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ResourceLibraryService } from './resource-library.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_MEDIUM,
  CACHE_PRIVATE_NO_STORE,
} from '../common/cache.interceptor';

/**
 * LingQ-style reading resource library (user-uploaded reading materials).
 *
 * Cache strategy:
 *  - User-specific resource lists get private medium-lived CDN caching.
 *  - Individual resource fetches are also medium-lived private caches.
 *  - Mutation endpoints (POST/PATCH/DELETE) use no-store.
 */
@Controller('resource-library')
@UseGuards(SupabaseAuthGuard)
export class ResourceLibraryController {
  constructor(private readonly resourceService: ResourceLibraryService) {}

  @Post()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  create(@CurrentUser() user: any, @Body() dto: CreateResourceDto) {
    return this.resourceService.create(user.id, dto);
  }

  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  findAll(
    @CurrentUser() user: any,
    @Query('topic') topic?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return this.resourceService.findAll(user.id, { topic, difficulty });
  }

  @Get(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_MEDIUM))
  findOne(@Param('id') id: string) {
    return this.resourceService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourceService.update(id, dto);
  }

  @Delete(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  remove(@Param('id') id: string) {
    return this.resourceService.remove(id);
  }
}
