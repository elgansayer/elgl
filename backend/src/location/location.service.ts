import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

interface LocationShare {
  id: string;
  sharer_user_id: string;
  viewer_user_id: string;
  active: boolean;
  latitude?: number;
  longitude?: number;
  updated_at?: string;
}

@Injectable()
export class LocationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async setCurrentLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const point = `POINT(${longitude} ${latitude})`;
    const { error } = await supabase
      .from('users')
      .update({ location: point } as never)
      .eq('id', userId);
    if (error) {
      throw new InternalServerErrorException(
        `Failed to set location: ${error.message}`,
      );
    }
  }

  async getCurrentLocation(
    userId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('location')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const location = (data as { location?: string | null }).location;
    if (!location) {
      return null;
    }

    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (!match) {
      return null;
    }

    return {
      longitude: parseFloat(match[1]),
      latitude: parseFloat(match[2]),
    };
  }

  async startLiveShare(
    sharerUserId: string,
    viewerUserId: string,
  ): Promise<{ id: string }> {
    if (!sharerUserId || !viewerUserId) {
      throw new BadRequestException(
        'Both sharer and viewer user IDs are required',
      );
    }
    const supabase = this.supabaseService.getClient();

    // Turn off previous active share for this sharer (just in case)
    await supabase
      .from('location_shares')
      .update({ active: false } as never)
      .eq('sharer_user_id', sharerUserId)
      .eq('active', true);

    const { data, error } = await supabase
      .from('location_shares')
      .insert([
        {
          sharer_user_id: sharerUserId,
          viewer_user_id: viewerUserId,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        `Failed to start live location: ${error?.message ?? 'No data'}`,
      );
    }
    return { id: data.id };
  }

  async updateLiveLocation(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from('location_shares')
      .update({
        latitude,
        longitude,
        updated_at: now,
      } as never)
      .eq('sharer_user_id', userId)
      .eq('active', true)
      .select('viewer_user_id');

    if (error) {
      throw new InternalServerErrorException(
        `Failed to update live location: ${error.message}`,
      );
    }

    const viewerIds = (rows ?? []) as unknown as Array<{
      viewer_user_id: string;
    }>;

    const payload = {
      sharer_user_id: userId,
      latitude,
      longitude,
      updated_at: now,
    };

    await Promise.all(
      viewerIds.map((viewer) =>
        this.publishToCentrifugo(
          `location_live_${viewer.viewer_user_id}`,
          payload,
        ),
      ),
    );
  }

  async stopLiveShare(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('location_shares')
      .update({ active: false } as never)
      .eq('sharer_user_id', userId)
      .eq('active', true);
    if (error) {
      throw new InternalServerErrorException(
        `Failed to stop live location: ${error.message}`,
      );
    }
  }

  private async publishToCentrifugo(
    channel: string,
    data: unknown,
  ): Promise<void> {
    const centrifugoUrl = this.configService.get<string>('CENTRIFUGO_URL');
    const centrifugoApiKey =
      this.configService.get<string>('CENTRIFUGO_API_KEY');

    if (!centrifugoUrl || !centrifugoApiKey) {
      Logger.warn(
        'Centrifugo credentials missing, skipping live location publication',
      );
      return;
    }

    const endpoint = `${centrifugoUrl.replace(/\/$/, '')}/api`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': centrifugoApiKey,
        },
        body: JSON.stringify({
          method: 'publish',
          params: {
            channel,
            data,
          },
        }),
      });

      if (!response.ok) {
        Logger.warn(
          `Centrifugo publish failed for channel ${channel}: ${response.statusText}`,
        );
      }
    } catch (error) {
      Logger.warn(
        `Centrifugo publish error for channel ${channel}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async getLiveLocationForViewer(
    viewerUserId: string,
    sharerUserId: string,
  ): Promise<{
    sharer_user_id: string;
    latitude: number;
    longitude: number;
    updated_at: string;
  }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('location_shares')
      .select('*')
      .eq('sharer_user_id', sharerUserId)
      .eq('viewer_user_id', viewerUserId)
      .eq('active', true)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(
        `No active live location share for viewer ${viewerUserId}`,
      );
    }
    const row = data as LocationShare;
    if (
      row.latitude === undefined ||
      row.longitude === undefined ||
      !row.updated_at
    ) {
      throw new NotFoundException('Live location not yet available');
    }
    return {
      sharer_user_id: row.sharer_user_id,
      latitude: row.latitude,
      longitude: row.longitude,
      updated_at: row.updated_at,
    };
  }
}
