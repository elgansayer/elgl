import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Post,
  UseGuards,
} from '@nestjs/common';
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
    @Param('userId') userId: string,
    @Body() dto: UpdateAudioIntroDto,
  ) {
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
