import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
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
    // Earned badge definitions may be displayed on member profiles. Current
    // counters/progress are intentionally not returned by this endpoint.
    return this.achievementsService.getUserAchievements(userId);
  }

  @Get('/full/:userId')
  async getFullAchievements(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.requireCurrentUser(req, userId);
    return this.achievementsService.getFullAchievements(userId);
  }

  @Get('/my')
  async getMyAchievements(@Req() req: AuthenticatedRequest) {
    const userId = this.requireCurrentUser(req);
    return this.achievementsService.getFullAchievements(userId);
  }

  @Post('/evaluate')
  async evaluateForCurrentUser(@Req() req: AuthenticatedRequest) {
    const userId = this.requireCurrentUser(req);
    await this.achievementsService.evaluateAchievements(userId);
    return { evaluated: true };
  }

  @Post('/evaluate/:userId')
  async evaluateForUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.requireCurrentUser(req, userId);
    await this.achievementsService.evaluateAchievements(userId);
    return { evaluated: true };
  }

  private requireCurrentUser(
    req: AuthenticatedRequest,
    requestedUserId?: string,
  ): string {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      throw new UnauthorizedException();
    }
    if (requestedUserId && requestedUserId !== currentUserId) {
      throw new ForbiddenException('Achievement progress is private');
    }
    return currentUserId;
  }
}
