import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Controller('milestones')
@UseGuards(AuthGuard('jwt'))
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  create(@Body() dto: CreateMilestoneDto, @Req() req: any) {
    const userId = req.user.id;
    return this.milestonesService.create(dto, userId);
  }

  @Get()
  findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.milestonesService.findAllForUser(userId);
  }

  @Get('progress')
  getProgress(@Req() req: any) {
    const userId = req.user.id;
    return this.milestonesService.getProgress(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.milestonesService.findOneForUser(userId, id);
  }

  @Post(':id/complete')
  markCompleted(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.milestonesService.markCompleted(id, userId);
  }
}
