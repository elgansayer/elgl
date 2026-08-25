import { Controller, Get, GoneException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LinkedAccountsService } from './linked-accounts.service';

@Controller('users/me/linked-accounts')
@UseGuards(SupabaseAuthGuard)
export class LinkedAccountsController {
  constructor(private readonly linkedAccountsService: LinkedAccountsService) {}

  @Get()
  async getLinkedAccounts(@CurrentUser() user: User) {
    return this.linkedAccountsService.getLinkedAccounts(user.id);
  }

  /**
   * Kept temporarily for mixed-version clients. OAuth identity linking requires
   * the authenticated browser session so the user can complete the provider
   * redirect. Never write a shadow "linked" record on the server.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('link')
  linkAccount(): never {
    throw new GoneException('Use the authenticated identity-linking flow');
  }

  /** See linkAccount. Identity unlinking is also session-bound in Supabase Auth. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('unlink')
  unlinkAccount(): never {
    throw new GoneException('Use the authenticated identity-linking flow');
  }
}
