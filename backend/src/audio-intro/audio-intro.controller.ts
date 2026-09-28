import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { AudioIntroService } from './audio-intro.service';
import { UpdateAudioIntroDto } from './dto/update-audio-intro.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('audio-intro')
export class AudioIntroController {
  constructor(private readonly audioIntroService: AudioIntroService) {}

  @Get(':userId')
  async getAudioIntro(@Param('userId') userId: string) {
    return this.audioIntroService.getAudioIntro(userId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':userId')
  async updateAudioIntro(
    @CurrentUser() user: User | null,
    @Param('userId') userId: string,
    @Body() dto: UpdateAudioIntroDto,
  ) {
    if (!user || user.id !== userId) {
      throw new UnauthorizedException('Cannot update another user\'s audio intro');
    }
    return this.audioIntroService.updateAudioIntro(userId, dto.audio_url);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('presigned-upload')
  async getUploadUrl(@Body() body: { filename: string; contentType: string }) {
    return this.audioIntroService.getPresignedUploadUrl(
      body.filename,
      body.contentType,
    );
  }
}
