import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PronunciationService } from './pronunciation.service';
import { PronunciationFeedbackResponseDto } from './dto/pronunciation-feedback.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('pronunciation')
@UseGuards(SupabaseAuthGuard)
export class PronunciationController {
 constructor(private readonly pronunciationService: PronunciationService) {}

 @Post('feedback')
 @UseInterceptors(FileInterceptor('audio'))
 async getFeedback(
  @UploadedFile() audio: Express.Multer.File,
  @Body('referenceText') referenceText?: string,
 ): Promise<PronunciationFeedbackResponseDto> {
  return this.pronunciationService.analyse(audio, referenceText);
 }
 @Post('voice-feedback')
 @UseInterceptors(FileInterceptor('audio'))
 async submitVoiceFeedback(
  @UploadedFile() audio: Express.Multer.File,
  @Body('feedbackText') feedbackText: string,
 ): Promise<{ success: boolean }> {
  return this.pronunciationService.processVoiceFeedback(audio, feedbackText);
 }
}
