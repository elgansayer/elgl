import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StudyBuddiesService } from './study-buddies.service';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';

@Controller('study-buddies')
@UseGuards(AuthGuard('jwt'))
export class StudyBuddiesController {
  constructor(private readonly sbService: StudyBuddiesService) {}

  @Post('request')
  requestBuddy(@Body() dto: StudyBuddyRequestDto, @Req() req: any) {
    const userId = req.user.id;
    return this.sbService.requestBuddy(dto, userId);
  }

  @Get('matches')
  getMatches(@Req() req: any) {
    const userId = req.user.id;
    return this.sbService.getPotentialBuddies(userId);
  }
}
