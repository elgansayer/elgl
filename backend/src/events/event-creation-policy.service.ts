import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EventCreationPolicyService {
  private readonly logger = new Logger(EventCreationPolicyService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async assertCanCreate(userId: string, dto: CreateEventDto): Promise<void> {
    this.assertFutureDate(dto.date_time);
    this.assertTimezone(dto.timezone);

    switch (dto.venue_type) {
      case 'audio_room':
        await this.assertOwnedAudioRoom(userId, dto.location);
        return;
      case 'zoom':
        this.assertSafeMeetingUrl(dto.location);
        return;
      case 'in_person':
        if (!dto.location.trim()) {
          throw new BadRequestException('A physical location is required');
        }
        return;
    }
  }

  private assertFutureDate(dateTime: string): void {
    const timestamp = Date.parse(dateTime);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      throw new BadRequestException(
        'Event date and time must be in the future',
      );
    }
  }

  private assertTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(0);
    } catch {
      throw new BadRequestException('Invalid event timezone');
    }
  }

  private assertSafeMeetingUrl(location: string): void {
    let url: URL;
    try {
      url = new URL(location);
    } catch {
      throw new BadRequestException('Meeting location must be a valid URL');
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new BadRequestException('Meeting URL must use http or https');
    }

    if (!url.hostname) {
      throw new BadRequestException('Meeting location must include a hostname');
    }
  }

  private async assertOwnedAudioRoom(
    userId: string,
    roomId: string,
  ): Promise<void> {
    if (!UUID_PATTERN.test(roomId)) {
      throw new BadRequestException(
        'Audio Room location must be a valid room ID',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data: room, error } = await supabase
      .from('audio_rooms')
      .select('id, host_id, is_active')
      .eq('id', roomId)
      .maybeSingle();

    if (error) {
      this.logger.warn('Unable to validate Audio Room for event creation');
      throw new BadRequestException('Audio Room could not be validated');
    }

    if (!room || !room.is_active) {
      throw new BadRequestException('Audio Room is unavailable');
    }

    if (room.host_id !== userId) {
      throw new ForbiddenException(
        'Only the Audio Room host can schedule an event for that room',
      );
    }
  }
}
