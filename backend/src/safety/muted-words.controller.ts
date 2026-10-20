import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { MutedWordDto, MutedWordsResponseDto } from './dto/muted-word.dto';
import { MutedWordsService } from './muted-words.service';

@Controller('safety/muted-words')
@UseGuards(SupabaseAuthGuard)
export class MutedWordsController {
  constructor(private readonly mutedWordsService: MutedWordsService) {}

  private requireUserId(user: User | null): string {
    if (!user?.id) {
      throw new UnauthorizedException();
    }
    return user.id;
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async list(@CurrentUser() user: User | null): Promise<MutedWordsResponseDto> {
    const words = await this.mutedWordsService.list(this.requireUserId(user));
    return { words };
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async add(
    @CurrentUser() user: User | null,
    @Body() dto: MutedWordDto,
  ): Promise<MutedWordsResponseDto> {
    const words = await this.mutedWordsService.add(
      this.requireUserId(user),
      dto.word,
    );
    return { words };
  }

  @Delete()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async remove(
    @CurrentUser() user: User | null,
    @Body() dto: MutedWordDto,
  ): Promise<MutedWordsResponseDto> {
    const words = await this.mutedWordsService.remove(
      this.requireUserId(user),
      dto.word,
    );
    return { words };
  }
}
