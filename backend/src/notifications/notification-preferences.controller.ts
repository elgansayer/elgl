import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { NotificationPreferences } from './interfaces/notification-preferences.interface';

@Controller('notification-preferences')
@UseGuards(SupabaseAuthGuard)
export class NotificationPreferencesController {
  constructor(
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  async getPreferences(
    @CurrentUser() user: { id: string },
  ): Promise<NotificationPreferences> {
    return this.preferencesService.getPreferences(user.id);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.preferencesService.updatePreferences(user.id, dto);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPreferences(
    @CurrentUser() user: { id: string },
  ): Promise<NotificationPreferences> {
    return this.preferencesService.resetToDefaults(user.id);
  }
}
