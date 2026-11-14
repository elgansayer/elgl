import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDeveloperBotDto } from './dto/create-developer-bot.dto';
import { UpdateDeveloperBotDto } from './dto/update-developer-bot.dto';
import { CustomEducationalBotRow } from './interfaces/custom-bot.interface';

@Injectable()
export class DeveloperBotsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listBots(ownerId: string): Promise<CustomEducationalBotRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_educational_bots')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException('Failed to list developer bots');
    }
    return (data ?? []) as CustomEducationalBotRow[];
  }

  async createBot(
    ownerId: string,
    dto: CreateDeveloperBotDto,
  ): Promise<CustomEducationalBotRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_educational_bots')
      .insert({
        owner_id: ownerId,
        display_name: dto.display_name,
        persona: dto.persona,
        target_language: dto.target_language,
        tone: dto.tone,
        greeting: dto.greeting ?? null,
        is_enabled: dto.is_enabled ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException('Failed to create developer bot');
    }
    return data as CustomEducationalBotRow;
  }

  async updateBot(
    botId: string,
    ownerId: string,
    dto: UpdateDeveloperBotDto,
  ): Promise<CustomEducationalBotRow> {
    const update: Partial<CustomEducationalBotRow> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.display_name !== undefined) update.display_name = dto.display_name;
    if (dto.persona !== undefined) update.persona = dto.persona;
    if (dto.target_language !== undefined)
      update.target_language = dto.target_language;
    if (dto.tone !== undefined) update.tone = dto.tone;
    if (dto.greeting !== undefined) update.greeting = dto.greeting;
    if (dto.is_enabled !== undefined) update.is_enabled = dto.is_enabled;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_educational_bots')
      .update(update)
      .eq('id', botId)
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Developer bot not found');
    }
    return data as CustomEducationalBotRow;
  }

  async deleteBot(botId: string, ownerId: string): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_educational_bots')
      .delete()
      .eq('id', botId)
      .eq('owner_id', ownerId)
      .select('id');

    if (error) {
      throw new InternalServerErrorException('Failed to delete developer bot');
    }
    if (!data || data.length === 0) {
      throw new NotFoundException('Developer bot not found');
    }
  }

  async getEnabledBot(
    botId: string,
    ownerId: string,
  ): Promise<CustomEducationalBotRow> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('custom_educational_bots')
      .select('*')
      .eq('id', botId)
      .eq('owner_id', ownerId)
      .single();

    if (error || !data || data.is_enabled === false) {
      throw new NotFoundException('Developer bot not found');
    }
    return data as CustomEducationalBotRow;
  }
}
