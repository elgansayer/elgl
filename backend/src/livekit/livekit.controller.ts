import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LivekitService, TokenResponse } from './livekit.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface TokenRequestDto {
  room_name: string;
  participant_identity: string;
}

interface AuthUser {
  id: string;
}

@Controller('livekit')
@UseGuards(SupabaseAuthGuard)
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  async generateToken(
    @CurrentUser() user: AuthUser | null,
    @Body() dto: TokenRequestDto,
  ): Promise<TokenResponse> {
    const identity = dto.participant_identity || user?.id || 'anonymous';
    return this.livekitService.generateToken(dto.room_name, identity);
  }
}