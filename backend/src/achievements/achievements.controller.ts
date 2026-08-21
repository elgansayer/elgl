import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';

@Controller('achievements')
@UseGuards(SupabaseAuthGuard)
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async listAchievements() {
    return this.achievementsService.listAchievements();
  }

  @Get('/user/:userId')
  async getUserAchievements(@Param('userId') userId: string) {
    return this.achievementsService.getUserAchievements(userId);
  }

  @Get('/full/:userId')
  async getFullAchievements(@Param('userId') userId: string) {
    return this.achievementsService.getFullAchievements(userId);
  }

  @Get('/my')
  async getMyAchievements(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    return this.achievementsService.getFullAchievements(userId);
  }

  @Post('/evaluate')
  async evaluateForCurrentUser(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    const userId = req.user.id;
    await this.achievementsService.evaluateAchievements(userId);
    return { evaluated: true };
  }

  @Post('/evaluate/:userId')
  async evaluateForUser(@Param('userId') userId: string) {
    await this.achievementsService.evaluateAchievements(userId);
    return { evaluated: true };
  }
}
