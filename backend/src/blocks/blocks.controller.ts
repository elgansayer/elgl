import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlocksService } from './blocks.service';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 10_000;

function parseBoundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException(`${name} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new BadRequestException(`${name} is out of range`);
  }
  return value;
}

function validateUserId(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} is required`);
  }
  const id = value.trim();
  if (!id || id.length > 128) {
    throw new BadRequestException(`${fieldName} is invalid`);
  }
  return id;
}

@Controller('blocks')
@UseGuards(SupabaseAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getBlockedUsers(
    @CurrentUser() user: User | null,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    if (!user) throw new UnauthorizedException();
    const limit = parseBoundedInteger(limitRaw, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE, 'limit');
    const offset = parseBoundedInteger(offsetRaw, 0, 0, MAX_OFFSET, 'offset');
    return this.blocksService.getBlockedUsers(user.id, limit, offset);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async blockUser(
    @CurrentUser() user: User | null,
    @Body() body: { blocked_id?: string },
  ) {
    if (!user) throw new UnauthorizedException();
    const blockedId = validateUserId(body?.blocked_id, 'blocked_id');
    if (blockedId === user.id) {
      throw new BadRequestException('A user cannot block themselves');
    }
    return this.blocksService.blockUser(user.id, blockedId);
  }

  @Delete(':blockedId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async unblockUser(
    @CurrentUser() user: User | null,
    @Param('blockedId') blockedIdRaw: string,
  ) {
    if (!user) throw new UnauthorizedException();
    const blockedId = validateUserId(blockedIdRaw, 'blockedId');
    return this.blocksService.unblockUser(user.id, blockedId);
  }
}
