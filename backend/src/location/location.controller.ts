import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { LocationService } from './location.service';

@Controller('location')
@UseGuards(SupabaseAuthGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post(':userId/current')
  async setCurrentLocation(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
    @Body('latitude', ParseFloatPipe) latitude: number,
    @Body('longitude', ParseFloatPipe) longitude: number,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    if (user.id !== userId) {
      throw new UnauthorizedException('Cannot modify another user location');
    }
    await this.locationService.setCurrentLocation(user.id, latitude, longitude);
    return { success: true };
  }

  @Get(':userId/current')
  async getCurrentLocation(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    if (!user) throw new UnauthorizedException();
    if (user.id !== userId) {
      throw new UnauthorizedException('Cannot read another user location');
    }
    return this.locationService.getCurrentLocation(userId);
  }

  @Post(':userId/live/start')
  async startLiveShare(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
    @Body('viewerUserId') viewerUserId: string,
  ): Promise<{ shareId: string; channel: string }> {
    if (!user) throw new UnauthorizedException();
    if (user.id !== userId) {
      throw new UnauthorizedException(
        'Cannot start live share for another user',
      );
    }
    if (!viewerUserId) {
      throw new UnauthorizedException('viewerUserId is required');
    }
    const share = await this.locationService.startLiveShare(
      user.id,
      viewerUserId,
    );
    return { shareId: share.id, channel: `location_live_${viewerUserId}` };
  }

  @Post(':userId/live/update')
  async updateLiveLocation(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
    @Body('latitude', ParseFloatPipe) latitude: number,
    @Body('longitude', ParseFloatPipe) longitude: number,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    if (user.id !== userId) {
      throw new UnauthorizedException(
        'Cannot update live location for another user',
      );
    }
    await this.locationService.updateLiveLocation(user.id, latitude, longitude);
    return { success: true };
  }

  @Delete(':userId/live')
  async stopLiveShare(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    if (user.id !== userId) {
      throw new UnauthorizedException(
        'Cannot stop live location for another user',
      );
    }
    await this.locationService.stopLiveShare(user.id);
    return { success: true };
  }

  @Get(':userId/live')
  async getLiveLocation(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
  ): Promise<{
    sharer_user_id: string;
    latitude: number;
    longitude: number;
    updated_at: string;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.locationService.getLiveLocationForViewer(user.id, userId);
  }
}
