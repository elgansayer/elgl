import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LinkedAccountsService } from './linked-accounts.service';
import type { Request } from 'express';

@Controller('users/me/linked-accounts')
@UseGuards(SupabaseAuthGuard)
export class LinkedAccountsController {
  constructor(private readonly linkedAccountsService: LinkedAccountsService) {}

  @Get()
  async getLinkedAccounts(@Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.linkedAccountsService.getLinkedAccounts(userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('link')
  async linkAccount(
    @Req() req: Request,
    @Body() body: { provider: string; name?: string },
  ) {
    const userId = (req as any).user?.id;
    await this.linkedAccountsService.linkAccount(
      userId,
      body.provider,
      body.name,
    );
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('unlink')
  async unlinkAccount(@Req() req: Request, @Body() body: { provider: string }) {
    const userId = (req as any).user?.id;
    await this.linkedAccountsService.unlinkAccount(userId, body.provider);
    return { success: true };
  }
}
