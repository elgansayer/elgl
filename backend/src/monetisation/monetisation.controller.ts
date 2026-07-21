import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StripeWebhookDto, UpgradeVipDto } from './dto/monetisation.dto';
import { MonetisationService } from './monetisation.service';

@Controller('monetisation')
export class MonetisationController {
  constructor(private readonly monetisationService: MonetisationService) {}

  @Post('upgrade')
  @UseGuards(SupabaseAuthGuard)
  async upgradeVip(
    @CurrentUser() user: User | null,
    @Body() dto: UpgradeVipDto,
  ) {
    if (!user) return null;
    return await this.monetisationService.upgradeUser(user.id, dto);
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleWebhook(@Body() dto: StripeWebhookDto) {
    return await this.monetisationService.handleStripeWebhook(dto);
  }

  @Post('generate-api-key')
  @UseGuards(SupabaseAuthGuard)
  async generateApiKey(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.generateApiKey(user.id);
  }

  @Get('analytics')
  @UseGuards(SupabaseAuthGuard)
  async getAnalytics(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDeveloperAnalytics(user.id);
  }
}
