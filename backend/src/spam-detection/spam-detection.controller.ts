import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SpamDetectionService } from './spam-detection.service';
import { SpamCheckDto } from './dto/spam-check.dto';

@Controller('spam-detection')
@UseGuards(SupabaseAuthGuard)
export class SpamDetectionController {
  constructor(private readonly spamDetectionService: SpamDetectionService) {}

  @Post('check')
  check(@Body() dto: SpamCheckDto): { isSpam: boolean } {
    const isSpam = this.spamDetectionService.isSpam(dto.content);
    return { isSpam };
  }
}
