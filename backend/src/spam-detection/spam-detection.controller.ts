import { Body, Controller, Post } from '@nestjs/common';
import { SpamDetectionService } from './spam-detection.service';
import { SpamCheckDto } from './dto/spam-check.dto';

@Controller('spam-detection')
export class SpamDetectionController {
  constructor(private readonly spamDetectionService: SpamDetectionService) {}

  @Post('check')
  check(@Body() dto: SpamCheckDto): { isSpam: boolean } {
    const isSpam = this.spamDetectionService.isSpam(dto.content);
    return { isSpam };
  }
}
