import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  MilestonesService,
  Milestone,
  MilestoneProgress,
} from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
}

@Controller('milestones')
@UseGuards(SupabaseAuthGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  async create(
    @Body() dto: CreateMilestoneDto,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<Milestone> {
    if (!dto.title || dto.title.trim().length === 0) {
      throw new Error('Validation failed');
    }
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.create(dto, userId);
  }

  @Get()
  findAll(@Request() req: { user?: AuthenticatedUser }): Promise<Milestone[]> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.findAllForUser(userId);
  }

  @Get('progress')
  getProgress(
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<MilestoneProgress> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.getProgress(userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<Milestone> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.findOneForUser(userId, id);
  }

  @Post(':id/complete')
  markCompleted(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<Milestone> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.markCompleted(id, userId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<void> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.milestonesService.remove(id, userId);
  }
}
